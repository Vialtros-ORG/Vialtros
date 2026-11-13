from unittest.mock import Mock, patch

from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import (
	Driver, Notification, NotificationType, Passenger, Route, RouteRating, Tracking, User,
)
from .views import _create_and_broadcast_notification, _should_notify, _should_notify_threshold


@override_settings(TRACKING_INGEST_TOKEN='gps-demo-token')
class TrackingIngestTests(APITestCase):
	def setUp(self):
		self.driver_user = User.objects.create_user(
			username='driver_ingest',
			password='secreto123',
			role='driver',
		)
		self.driver = Driver.objects.create(user=self.driver_user, license_number='DRV-001')
		self.route = Route.objects.create(
			name='Ruta GPS',
			origin='Centro',
			destination='Terminal',
			driver=self.driver,
		)

	def test_ingest_allows_service_token_without_passenger(self):
		timestamp = timezone.now().replace(microsecond=0)

		response = self.client.post(
			'/api/tracking/ingest/',
			{
				'route': self.route.id,
				'latitude': 3.8891,
				'longitude': -77.0284,
				'status': 'picked',
				'timestamp': timestamp.isoformat(),
				'speed_kmh': 31.4,
				'source': 'gps-device-001',
			},
			format='json',
			HTTP_X_TRACKING_TOKEN='gps-demo-token',
		)

		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertEqual(Tracking.objects.count(), 1)

		tracking = Tracking.objects.get()
		self.assertIsNone(tracking.passenger)
		self.assertEqual(tracking.route_id, self.route.id)
		self.assertEqual(tracking.speed_kmh, 31.4)
		self.assertEqual(response.data['route'], self.route.id)
		self.assertEqual(response.data['source'], 'gps-device-001')
		self.assertEqual(response.data['speed_kmh'], 31.4)
		self.assertTrue(response.data['timestamp'].startswith(timestamp.isoformat().replace('+00:00', '')))

	def test_ingest_rejects_invalid_service_token(self):
		response = self.client.post(
			'/api/tracking/ingest/',
			{
				'route': self.route.id,
				'latitude': 3.8891,
				'longitude': -77.0284,
			},
			format='json',
			HTTP_X_TRACKING_TOKEN='token-invalido',
		)

		self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
		self.assertEqual(Tracking.objects.count(), 0)

	@override_settings(DEBUG=True, TRACKING_INGEST_TOKEN='')
	def test_ingest_allows_local_dev_token_in_debug(self):
		response = self.client.post(
			'/api/tracking/ingest/',
			{
				'route': self.route.id,
				'latitude': 3.8891,
				'longitude': -77.0284,
			},
			format='json',
			HTTP_X_TRACKING_TOKEN='local-dev-access',
		)

		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertEqual(Tracking.objects.count(), 1)


class RouteMonitoringSummaryTests(APITestCase):
	def setUp(self):
		self.admin_user = User.objects.create_user(
			username='admin_monitor',
			password='secreto123',
			role='admin',
		)
		self.driver_user = User.objects.create_user(
			username='driver_monitor',
			password='secreto123',
			role='driver',
		)
		self.driver = Driver.objects.create(user=self.driver_user, license_number='DRV-777')
		self.route_live = Route.objects.create(
			name='Ruta Centro',
			origin='Centro',
			destination='Colegio',
			driver=self.driver,
		)
		self.route_without_driver = Route.objects.create(
			name='Ruta Norte',
			origin='Terminal',
			destination='Campus',
		)
		self.route_stale = Route.objects.create(
			name='Ruta Sur',
			origin='Muelle',
			destination='Barrio Bellavista',
			driver=self.driver,
		)
		self.passenger_one = Passenger.objects.create(
			user=User.objects.create_user(username='student_one', password='secreto123', role='user'),
			phone='111',
			pickup_address='Pueblo Nuevo',
			pickup_lat=3.88982,
			pickup_lng=-77.07077,
		)
		self.passenger_two = Passenger.objects.create(
			user=User.objects.create_user(username='student_two', password='secreto123', role='user'),
			phone='222',
			pickup_address='Bellavista',
			pickup_lat=3.88291,
			pickup_lng=-77.04041,
		)
		self.route_live.passengers.add(self.passenger_one, self.passenger_two)

		now = timezone.now()
		Tracking.objects.create(
			route=self.route_live,
			passenger=self.passenger_one,
			status='not_picked',
			latitude=3.8845,
			longitude=-77.0325,
			timestamp=now - timezone.timedelta(minutes=3),
		)
		Tracking.objects.create(
			route=self.route_live,
			passenger=self.passenger_one,
			status='picked',
			latitude=3.8905,
			longitude=-77.0260,
			timestamp=now - timezone.timedelta(minutes=1),
		)
		Tracking.objects.create(
			route=self.route_live,
			passenger=self.passenger_two,
			status='not_picked',
			latitude=3.8904,
			longitude=-77.0262,
			timestamp=now - timezone.timedelta(minutes=1),
		)
		Tracking.objects.create(
			route=self.route_stale,
			latitude=3.88,
			longitude=-77.03,
			timestamp=now - timezone.timedelta(minutes=12),
		)

		self.client.force_authenticate(user=self.admin_user)

	def test_monitoring_summary_returns_backend_progress_and_alerts(self):
		response = self.client.get('/api/routes/monitoring-summary/')

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data['stats']['students_total'], 2)
		self.assertEqual(response.data['stats']['vehicles_active'], 1)

		route_live = next(item for item in response.data['routes'] if item['id'] == self.route_live.id)
		self.assertEqual(route_live['progress_percent'], 50)
		self.assertEqual(route_live['students_picked'], 1)
		self.assertEqual(route_live['state_label'], 'En seguimiento')
		self.assertEqual(len(route_live['intermediate_stops']), 2)
		self.assertEqual(
			{stop['address'] for stop in route_live['intermediate_stops']},
			{'Bellavista', 'Pueblo Nuevo'},
		)
		self.assertIn('origin_lat', route_live)

		route_without_driver = next(item for item in response.data['routes'] if item['id'] == self.route_without_driver.id)
		self.assertEqual(route_without_driver['state_label'], 'Sin conductor')

		alert_titles = [alert['title'] for alert in response.data['alerts']]
		self.assertIn('Rutas sin conductor', alert_titles)
		self.assertIn('Señal desactualizada', alert_titles)
		self.assertIn('Recogida al 50% o menos', alert_titles)

		stale_signal_alert = next(alert for alert in response.data['alerts'] if alert['title'] == 'Señal desactualizada')
		self.assertIn(self.route_stale.id, stale_signal_alert['route_ids'])

	def test_route_detail_exposes_intermediate_stops(self):
		response = self.client.get(f'/api/routes/{self.route_live.id}/')

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(len(response.data['intermediate_stops']), 2)
		self.assertIn('pickup_lat', response.data['passenger_details'][0])


class WeeklyActivityTests(APITestCase):
	def setUp(self):
		self.admin_user = User.objects.create_user(username='admin_weekly', password='secreto123', role='admin')
		self.driver_user = User.objects.create_user(username='driver_weekly', password='secreto123', role='driver')
		self.driver = Driver.objects.create(user=self.driver_user, license_number='DRV-WEEK')
		self.user_account = User.objects.create_user(username='user_weekly', password='secreto123', role='user')
		self.passenger = Passenger.objects.create(user=self.user_account, phone='3000000000')

		self.route_assigned = Route.objects.create(
			name='Ruta semanal',
			origin='Centro',
			destination='Universidad',
			driver=self.driver,
		)
		self.route_assigned.passengers.add(self.passenger)

		self.other_driver_user = User.objects.create_user(username='driver_other', password='secreto123', role='driver')
		self.other_driver = Driver.objects.create(user=self.other_driver_user, license_number='DRV-OTHER')
		self.other_route = Route.objects.create(
			name='Ruta externa',
			origin='Muelle',
			destination='Terminal',
			driver=self.other_driver,
		)

		now = timezone.now().replace(hour=9, minute=0, second=0, microsecond=0)
		Tracking.objects.create(
			route=self.route_assigned,
			latitude=3.88,
			longitude=-77.03,
			timestamp=now,
		)
		Tracking.objects.create(
			route=self.route_assigned,
			passenger=self.passenger,
			status='picked',
			latitude=3.881,
			longitude=-77.031,
			timestamp=now - timezone.timedelta(days=1),
		)
		Tracking.objects.create(
			route=self.other_route,
			latitude=3.87,
			longitude=-77.01,
			timestamp=now - timezone.timedelta(days=2),
		)
		Tracking.objects.create(
			route=self.other_route,
			latitude=3.86,
			longitude=-77.00,
			timestamp=now - timezone.timedelta(days=10),
		)

	def test_admin_weekly_activity_counts_all_recent_trackings(self):
		self.client.force_authenticate(user=self.admin_user)

		response = self.client.get('/api/users/weekly-activity/')

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(sum(item['value'] for item in response.data), 3)

	def test_driver_weekly_activity_counts_only_assigned_routes(self):
		self.client.force_authenticate(user=self.driver_user)

		response = self.client.get('/api/users/weekly-activity/')

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(sum(item['value'] for item in response.data), 2)


class RecentActivityTests(APITestCase):
	def setUp(self):
		self.admin_user = User.objects.create_user(username='admin_recent', password='secreto123', role='admin')
		self.driver_user = User.objects.create_user(username='driver_recent', password='secreto123', role='driver')
		self.driver = Driver.objects.create(user=self.driver_user, license_number='DRV-RECENT')
		self.user_account = User.objects.create_user(username='user_recent', password='secreto123', role='user')
		self.passenger = Passenger.objects.create(user=self.user_account, phone='3111111111')
		self.new_user = User.objects.create_user(username='nuevo_registro', password='secreto123', role='user')
		self.new_user.date_joined = timezone.now() - timezone.timedelta(minutes=10)
		self.new_user.save(update_fields=['date_joined'])

		self.route_assigned = Route.objects.create(
			name='Ruta Centro',
			origin='Centro',
			destination='Universidad',
			driver=self.driver,
		)
		self.route_assigned.passengers.add(self.passenger)

		other_driver_user = User.objects.create_user(username='driver_ajeno', password='secreto123', role='driver')
		other_driver = Driver.objects.create(user=other_driver_user, license_number='DRV-OTH')
		self.other_route = Route.objects.create(
			name='Ruta Externa',
			origin='Muelle',
			destination='Terminal',
			driver=other_driver,
		)

		now = timezone.now()
		Tracking.objects.create(
			route=self.route_assigned,
			latitude=3.88,
			longitude=-77.03,
			speed_kmh=28,
			timestamp=now - timezone.timedelta(minutes=5),
		)
		Tracking.objects.create(
			route=self.route_assigned,
			passenger=self.passenger,
			status='picked',
			latitude=3.881,
			longitude=-77.031,
			timestamp=now - timezone.timedelta(minutes=2),
		)
		Tracking.objects.create(
			route=self.other_route,
			latitude=3.87,
			longitude=-77.01,
			speed_kmh=24,
			timestamp=now - timezone.timedelta(minutes=1),
		)

	def test_admin_recent_activity_mixes_recent_users_and_tracking(self):
		self.client.force_authenticate(user=self.admin_user)

		response = self.client.get('/api/users/recent-activity/')

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		titles = [item['title'] for item in response.data]
		self.assertIn('Nuevo usuario registrado', titles)
		self.assertTrue(any('Ruta Externa' in title or 'Ruta Centro' in title for title in titles))

	def test_driver_recent_activity_only_uses_assigned_routes(self):
		self.client.force_authenticate(user=self.driver_user)

		response = self.client.get('/api/users/recent-activity/')

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		serialized = ' '.join(item['title'] for item in response.data)
		self.assertIn('Ruta Centro', serialized)
		self.assertNotIn('Ruta Externa', serialized)
		self.assertTrue(all(item['icon'] != 'addUser' for item in response.data))

	def test_user_recent_activity_uses_assigned_route_and_personal_pickup_message(self):
		self.client.force_authenticate(user=self.user_account)

		response = self.client.get('/api/users/recent-activity/')

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		titles = [item['title'] for item in response.data]
		self.assertIn('Tu recogida fue confirmada', titles)
		self.assertTrue(all('Ruta Externa' not in item['title'] for item in response.data))

	def test_user_weekly_activity_counts_assigned_route_monitoring(self):
		self.client.force_authenticate(user=self.user_account)

		response = self.client.get('/api/users/weekly-activity/')

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(sum(item['value'] for item in response.data), 2)


class AdminProtectionTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='admin_unico',
            password='secreto123',
            role='admin',
        )
        self.client.force_authenticate(user=self.admin)

    def test_cannot_delete_only_admin(self):
        response = self.client.delete(f'/api/users/{self.admin.id}/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(User.objects.filter(id=self.admin.id).exists())
        self.assertEqual(
            response.data['detail'],
            'No se puede eliminar el único administrador del sistema.'
        )

class TrackingStatusValidationTests(APITestCase):
    def setUp(self):
        self.driver_user = User.objects.create_user(
            username='driver_status',
            password='secreto123',
            role='driver',
        )
        self.driver = Driver.objects.create(
            user=self.driver_user,
            license_number='DRV-STATUS',
        )
        self.route = Route.objects.create(
            name='Ruta Estado',
            origin='Centro',
            destination='Universidad',
            driver=self.driver,
        )
        self.tracking = Tracking.objects.create(
            route=self.route,
            latitude=3.45,
            longitude=-76.53,
        )
        self.client.force_authenticate(user=self.driver_user)

    def test_rejects_invalid_tracking_status(self):
        response = self.client.post(
            f'/api/tracking/{self.tracking.id}/update_status/',
            {'status': 'estado_invalido'},
            format='json',
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )


class TrackingPassengerAssignmentTests(APITestCase):
    def setUp(self):
        self.driver_user = User.objects.create_user(username='driver_pickup', password='secreto123', role='driver')
        self.driver = Driver.objects.create(user=self.driver_user, license_number='DRV-PICKUP')
        self.route = Route.objects.create(name='Ruta asignada', origin='Centro', destination='Colegio', driver=self.driver)
        self.passenger = Passenger.objects.create(
            user=User.objects.create_user(username='passenger_pickup', password='secreto123', role='user'),
            phone='3001234567', pickup_address='Parada registrada', pickup_lat=3.89, pickup_lng=-77.03,
        )
        self.client.force_authenticate(user=self.driver_user)

    def test_driver_cannot_update_passenger_outside_assigned_route(self):
        response = self.client.post('/api/tracking/update_status_by_passenger/', {
            'route_id': self.route.id,
            'passenger_id': self.passenger.id,
            'status': 'picked',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Tracking.objects.filter(route=self.route, passenger=self.passenger).exists())

    def test_pickup_event_uses_passenger_stop_coordinates(self):
        self.route.passengers.add(self.passenger)
        response = self.client.post('/api/tracking/update_status_by_passenger/', {
            'route_id': self.route.id,
            'passenger_id': self.passenger.id,
            'status': 'picked',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        tracking = Tracking.objects.get(route=self.route, passenger=self.passenger)
        self.assertEqual(tracking.latitude, self.passenger.pickup_lat)
        self.assertEqual(tracking.longitude, self.passenger.pickup_lng)
        self.assertNotEqual((tracking.latitude, tracking.longitude), (0.0, 0.0))


class RouteRatingAuthorizationTests(APITestCase):
    def setUp(self):
        self.driver_user = User.objects.create_user(username='driver_rating', password='secreto123', role='driver')
        self.driver = Driver.objects.create(user=self.driver_user, license_number='DRV-RATING')
        self.other_driver_user = User.objects.create_user(username='other_driver_rating', password='secreto123', role='driver')
        self.other_driver = Driver.objects.create(user=self.other_driver_user, license_number='DRV-OTHER-RATING')
        self.route = Route.objects.create(name='Ruta propia', origin='Centro', destination='Colegio', driver=self.driver)
        self.other_route = Route.objects.create(name='Ruta ajena', origin='Puerto', destination='Terminal', driver=self.other_driver)

    def test_driver_cannot_rate_route_assigned_to_another_driver(self):
        self.client.force_authenticate(user=self.driver_user)
        response = self.client.post('/api/route-ratings/', {
            'route': self.other_route.id,
            'stars': 5,
            'comment': 'Calificación no autorizada',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(RouteRating.objects.filter(route=self.other_route).exists())

    def test_passenger_cannot_create_route_rating(self):
        passenger = User.objects.create_user(username='passenger_rating', password='secreto123', role='user')
        self.client.force_authenticate(user=passenger)
        response = self.client.post('/api/route-ratings/', {
            'route': self.route.id,
            'stars': 4,
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(RouteRating.objects.exists())

class RouteNotFoundTests(APITestCase):
    def setUp(self):
        self.admin_user = User.objects.create_user(
            username='admin_route_test',
            password='secreto123',
            role='admin',
        )
        self.client.force_authenticate(user=self.admin_user)

    def test_route_detail_returns_404_when_route_does_not_exist(self):
        response = self.client.get('/api/routes/999999/')

        self.assertEqual(
            response.status_code,
            status.HTTP_404_NOT_FOUND,
        )

class AuthenticationRequiredTests(APITestCase):
    def test_notifications_require_authentication(self):
        response = self.client.get('/api/notifications/')

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )


class NotificationHelperCoverageTests(APITestCase):
	def setUp(self):
		self.user = User.objects.create_user(
			username='notification_helper',
			password='secreto123',
			role='user',
		)

	def test_notification_cooldown_prevents_duplicate_notifications(self):
		self.assertTrue(_should_notify(self.user, NotificationType.ROUTE_STARTED, None))
		Notification.objects.create(
			user=self.user,
			type=NotificationType.ROUTE_STARTED,
			title='Ruta iniciada',
			message='La ruta comenzó',
		)

		self.assertFalse(_should_notify(self.user, NotificationType.ROUTE_STARTED, None))

	def test_notification_threshold_cooldown_is_specific_to_each_threshold(self):
		Notification.objects.create(
			user=self.user,
			type=NotificationType.DRIVER_NEAR_STOP,
			title='Próxima parada',
			message='El conductor se acerca',
			metadata={'threshold': '150m'},
		)

		self.assertFalse(_should_notify_threshold(
			self.user, NotificationType.DRIVER_NEAR_STOP, None, '150m',
		))
		self.assertTrue(_should_notify_threshold(
			self.user, NotificationType.DRIVER_NEAR_STOP, None, '50m',
		))

	def test_notification_is_saved_when_no_channel_layer_is_configured(self):
		with patch('users.views.get_channel_layer', return_value=None):
			notification = _create_and_broadcast_notification(
				self.user,
				NotificationType.ROUTE_STARTED,
				'Ruta iniciada',
				'La ruta comenzó',
			)

		self.assertEqual(notification.user, self.user)
		self.assertEqual(Notification.objects.count(), 1)

	def test_notification_broadcast_failure_does_not_discard_saved_notification(self):
		channel_layer = Mock()
		with patch('users.views.get_channel_layer', return_value=channel_layer), \
				patch('users.views.async_to_sync', side_effect=RuntimeError('websocket offline')):
			with self.assertLogs('users.views', level='WARNING'):
				notification = _create_and_broadcast_notification(
					self.user,
					NotificationType.ROUTE_STARTED,
					'Ruta iniciada',
					'La ruta comenzó',
				)

		self.assertIsNotNone(notification.pk)
		self.assertEqual(Notification.objects.count(), 1)


class RoutePermissionTests(APITestCase):
    def setUp(self):
        self.normal_user = User.objects.create_user(
            username='usuario_sin_permiso',
            password='secreto123',
            role='user',
        )
        self.client.force_authenticate(user=self.normal_user)

    def test_normal_user_cannot_access_route_admin_endpoint(self):
        response = self.client.get('/api/routes/')

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )
