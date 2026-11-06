from asgiref.sync import async_to_sync
from channels.testing import WebsocketCommunicator
from core.asgi import application
from django.test import TransactionTestCase
from django.test import override_settings
from django.core.management import call_command, CommandError
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken
from io import StringIO
from unittest.mock import patch

from .models import Driver, Passenger, Route, Tracking, User
from .serializers import (
    DriverSerializer,
    PassengerSerializer,
    RouteSerializer,
    TrackingIngestSerializer,
    UserCreateSerializer,
    UserProfileSerializer,
    UserSerializer,
)


class MyConductorEndpointTests(APITestCase):
	def setUp(self):
		self.passenger_user = User.objects.create_user(
			username='passenger_route_test',
			password='secreto123',
			role='user',
		)

	def test_missing_passenger_profile_returns_conflict(self):
		self.client.force_authenticate(user=self.passenger_user)

		response = self.client.get('/api/users/my_conductor/')

		self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
		self.assertIn('perfil de pasajero', response.data['detail'])

	def test_non_passenger_role_is_forbidden(self):
		driver_user = User.objects.create_user(
			username='driver_route_test',
			password='secreto123',
			role='driver',
		)
		self.client.force_authenticate(user=driver_user)

		response = self.client.get('/api/users/my_conductor/')

		self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

	def test_passenger_receives_route_and_stop_coordinates(self):
		passenger = Passenger.objects.create(
			user=self.passenger_user,
			phone='3000000000',
			pickup_address='Parada de prueba',
			pickup_lat=3.88982,
			pickup_lng=-77.07077,
		)
		driver_user = User.objects.create_user(
			username='assigned_driver_test',
			password='secreto123',
			role='driver',
		)
		driver = Driver.objects.create(user=driver_user, license_number='DRV-TEST')
		route = Route.objects.create(
			name='Ruta de prueba',
			origin='Buenaventura Centro',
			destination='Bellavista',
			origin_lat=3.8891,
			origin_lng=-77.0284,
			destination_lat=3.88291,
			destination_lng=-77.04041,
			driver=driver,
		)
		route.passengers.add(passenger)
		self.client.force_authenticate(user=self.passenger_user)

		response = self.client.get('/api/users/my_conductor/')

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data['route']['id'], route.id)
		self.assertEqual(response.data['driver']['id'], driver.id)
		self.assertEqual(len(response.data['route']['intermediate_stops']), 1)
		self.assertEqual(
			response.data['route']['intermediate_stops'][0]['latitude'],
			passenger.pickup_lat,
		)

	def test_passenger_tracking_feed_contains_bus_gps_and_only_own_status(self):
		passenger = Passenger.objects.create(
			user=self.passenger_user,
			phone='3000000000',
			pickup_address='Parada de prueba',
			pickup_lat=3.88982,
			pickup_lng=-77.07077,
		)
		other_passenger = Passenger.objects.create(
			user=User.objects.create_user(
				username='other_passenger_test',
				password='secreto123',
				role='user',
			),
			phone='3000000001',
		)
		route = Route.objects.create(
			name='Ruta compartida de prueba',
			origin='Centro',
			destination='Bellavista',
		)
		route.passengers.add(passenger, other_passenger)
		bus_gps = Tracking.objects.create(
			route=route,
			latitude=3.8891,
			longitude=-77.0284,
		)
		own_status = Tracking.objects.create(
			route=route,
			passenger=passenger,
			latitude=3.89,
			longitude=-77.03,
		)
		Tracking.objects.create(
			route=route,
			passenger=other_passenger,
			latitude=3.88,
			longitude=-77.04,
		)
		self.client.force_authenticate(user=self.passenger_user)

		response = self.client.get(f'/api/tracking/?route={route.id}')

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(
			{item['id'] for item in response.data},
			{bus_gps.id, own_status.id},
		)
		stats = self.client.get('/api/users/dashboard_stats/')
		self.assertEqual(stats.status_code, status.HTTP_200_OK)
		self.assertEqual(stats.data['routes'], 1)
		self.assertEqual(stats.data['users'], 2)
		self.assertEqual(stats.data['trackings'], 2)


class TrackingWebSocketAccessTests(TransactionTestCase):
	def setUp(self):
		self.admin = User.objects.create_user(
			username='ws_admin_test', password='secreto123', role='admin'
		)
		self.driver_user = User.objects.create_user(
			username='ws_driver_test', password='secreto123', role='driver'
		)
		self.driver = Driver.objects.create(
			user=self.driver_user, license_number='WS-DRV-001'
		)
		self.passenger_user = User.objects.create_user(
			username='ws_passenger_test', password='secreto123', role='user'
		)
		self.passenger = Passenger.objects.create(
			user=self.passenger_user, phone='3000000000'
		)
		self.route = Route.objects.create(
			name='Ruta WebSocket', origin='Centro', destination='Terminal',
			driver=self.driver,
		)
		self.route.passengers.add(self.passenger)
		self.other_driver = User.objects.create_user(
			username='ws_other_driver_test', password='secreto123', role='driver'
		)
		Driver.objects.create(user=self.other_driver, license_number='WS-DRV-002')

	def connect_as(self, user=None):
		token = f'?token={AccessToken.for_user(user)}' if user else ''
		communicator = WebsocketCommunicator(
			application,
			f'/ws/tracking/{self.route.id}/{token}',
		)

		async def connect_and_disconnect():
			connected, detail = await communicator.connect()
			if connected:
				await communicator.disconnect()
			return connected, detail

		return async_to_sync(connect_and_disconnect)()

	def test_tracking_websocket_requires_authentication(self):
		connected, close_code = self.connect_as()

		self.assertFalse(connected)
		self.assertEqual(close_code, 4401)

	def test_tracking_websocket_allows_assigned_roles_only(self):
		for user in (self.admin, self.driver_user, self.passenger_user):
			with self.subTest(role=user.role):
				connected, _ = self.connect_as(user)
				self.assertTrue(connected)

		connected, close_code = self.connect_as(self.other_driver)
		self.assertFalse(connected)
		self.assertEqual(close_code, 4403)


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


class UserInputAcceptanceTests(APITestCase):
    def valid_user_payload(self, **overrides):
        payload = {
            'username': '  Juan.Perez ',
            'first_name': '  aNA   mARÍA ',
            'last_name': "o'NEILL",
            'email': '  ANA@EXAMPLE.COM ',
            'role': 'user',
            'password': 'vialtros-Strong-2026!42',
        }
        payload.update(overrides)
        return payload

    def test_user_fields_are_trimmed_normalized_and_validated(self):
        serializer = UserCreateSerializer(data=self.valid_user_payload())

        self.assertTrue(serializer.is_valid(), serializer.errors)
        user = serializer.save()

        self.assertEqual(user.username, 'juan.perez')
        self.assertEqual(user.first_name, 'Ana María')
        self.assertEqual(user.last_name, "O'Neill")
        self.assertEqual(user.email, 'ana@example.com')

    def test_user_name_rejects_numbers_and_invalid_username(self):
        bad_name = UserCreateSerializer(data=self.valid_user_payload(first_name='Ana2'))
        bad_username = UserCreateSerializer(data=self.valid_user_payload(username='ana perez'))

        self.assertFalse(bad_name.is_valid())
        self.assertIn('first_name', bad_name.errors)
        self.assertFalse(bad_username.is_valid())
        self.assertIn('username', bad_username.errors)

    def test_duplicate_usernames_and_emails_are_case_insensitive(self):
        User.objects.create_user(
            username='juan.perez',
            email='ana@example.com',
            password='existing-Strong-2026!42',
        )
        serializer = UserCreateSerializer(data=self.valid_user_payload())

        self.assertFalse(serializer.is_valid())
        self.assertIn('username', serializer.errors)
        self.assertIn('email', serializer.errors)

    def test_new_user_password_must_meet_project_policy(self):
        serializer = UserCreateSerializer(
            data=self.valid_user_payload(password='12345678')
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('password', serializer.errors)

    def test_passenger_phone_is_normalized_to_colombian_e164(self):
        user = User.objects.create_user(username='phone_test', password='secreto123')
        serializer = PassengerSerializer(data={
            'user': user.id,
            'phone': '(300) 123-4567',
        })

        self.assertTrue(serializer.is_valid(), serializer.errors)
        passenger = serializer.save()
        self.assertEqual(passenger.phone, '+573001234567')

    def test_passenger_phone_rejects_invalid_length(self):
        user = User.objects.create_user(username='phone_invalid', password='secreto123')
        serializer = PassengerSerializer(data={
            'user': user.id,
            'phone': '123',
        })

        self.assertFalse(serializer.is_valid())
        self.assertIn('phone', serializer.errors)

    def test_driver_license_is_trimmed_and_canonicalized(self):
        user = User.objects.create_user(username='license_test', password='secreto123')
        serializer = DriverSerializer(data={
            'user': user.id,
            'license_number': ' lic-1234 ',
        })

        self.assertTrue(serializer.is_valid(), serializer.errors)
        driver = serializer.save()
        self.assertEqual(driver.license_number, 'LIC-1234')


class CoordinateInputAcceptanceTests(APITestCase):
    def setUp(self):
        self.route = Route.objects.create(
            name='Ruta de coordenadas',
            origin='Centro',
            destination='Puerto',
        )

    def test_route_rejects_latitude_outside_earth_bounds(self):
        serializer = RouteSerializer(data={
            'name': 'Ruta de prueba',
            'origin': 'Centro',
            'destination': 'Puerto',
            'origin_lat': 91,
            'origin_lng': -77,
        })

        self.assertFalse(serializer.is_valid())
        self.assertIn('origin_lat', serializer.errors)

    def test_route_requires_coordinate_pairs(self):
        serializer = RouteSerializer(data={
            'name': 'Ruta de prueba',
            'origin': 'Centro',
            'destination': 'Puerto',
            'origin_lat': 3.9,
        })

        self.assertFalse(serializer.is_valid())
        self.assertIn('origin_lat', serializer.errors)

    def test_tracking_ingest_rejects_invalid_gps_and_speed(self):
        invalid_latitude = TrackingIngestSerializer(data={
            'route': self.route.id,
            'latitude': 91,
            'longitude': -77,
        })
        invalid_speed = TrackingIngestSerializer(data={
            'route': self.route.id,
            'latitude': 3.9,
            'longitude': -77,
            'speed_kmh': 301,
        })

        self.assertFalse(invalid_latitude.is_valid())
        self.assertIn('latitude', invalid_latitude.errors)
        self.assertFalse(invalid_speed.is_valid())
        self.assertIn('speed_kmh', invalid_speed.errors)


class CreateAdminCommandTests(APITestCase):
    password = 'Unique-Vialtros-Admin!2026'

    def test_creates_superuser_without_printing_password(self):
        output = StringIO()
        with patch.dict('os.environ', {'VIALTROS_ADMIN_PASSWORD': self.password}):
            call_command('create_admin', username='secure_admin', stdout=output)

        admin = User.objects.get(username='secure_admin')
        self.assertTrue(admin.is_superuser)
        self.assertTrue(admin.check_password(self.password))
        self.assertNotIn(self.password, output.getvalue())

    def test_invalid_username_is_rejected(self):
        with self.assertRaises(CommandError):
            call_command('create_admin', username='bad name')

    def test_admin_creation_requires_password_in_noninteractive_runs(self):
        fake_stdin = StringIO()
        fake_stdin.isatty = lambda: False
        with patch.dict('os.environ', {'VIALTROS_ADMIN_PASSWORD': ''}), patch(
            'users.management.commands.create_admin.sys.stdin', fake_stdin
        ):
            with self.assertRaises(CommandError):
                call_command('create_admin', username='secure_admin')

    def test_existing_superuser_is_not_changed(self):
        existing = User.objects.create_superuser(
            username='admin', password=self.password, role='admin'
        )
        output = StringIO()
        call_command('create_admin', username='another_admin', stdout=output)

        self.assertIn(existing.username, output.getvalue())
        self.assertFalse(User.objects.filter(username='another_admin').exists())

    def test_admin_role_without_superuser_privileges_is_rejected(self):
        User.objects.create_user(
            username='unsafe_admin', password=self.password, role='admin'
        )
        with self.assertRaises(CommandError):
            call_command('create_admin', username='another_admin')

    def test_invalid_password_is_rejected(self):
        with patch.dict('os.environ', {'VIALTROS_ADMIN_PASSWORD': 'short'}):
            with self.assertRaises(CommandError):
                call_command('create_admin', username='secure_admin')

    def test_email_is_validated_and_unique(self):
        with patch.dict('os.environ', {'VIALTROS_ADMIN_PASSWORD': self.password}):
            with self.assertRaises(CommandError):
                call_command('create_admin', username='secure_admin', email='not-email')

            User.objects.create_user(
                username='existing_user', email='admin@example.com', password=self.password
            )
            with self.assertRaises(CommandError):
                call_command('create_admin', username='secure_admin', email='ADMIN@example.com')


class UserSerializerValidationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='serializer_user',
            email='serializer@example.com',
            password='secreto123',
            first_name='Ana',
            last_name='Rojas',
            phone_number='+573001234567',
        )

    def test_user_serializer_normalizes_fields_and_allows_own_values_on_update(self):
        serializer = UserSerializer(
            instance=self.user,
            data={
                'username': ' SERIALIZER_USER ',
                'email': ' SERIALIZER@EXAMPLE.COM ',
                'first_name': '  ana   maria ',
                'last_name': ' ROJAS ',
                'phone_number': '300 123 4567',
            },
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['username'], 'serializer_user')
        self.assertEqual(serializer.validated_data['email'], 'serializer@example.com')
        self.assertEqual(serializer.validated_data['first_name'], 'Ana Maria')
        self.assertEqual(serializer.validated_data['phone_number'], '+573001234567')

    def test_user_serializer_rejects_invalid_and_duplicate_usernames_and_emails(self):
        invalid_username = UserSerializer(data={'username': 'ab'}, partial=True)
        duplicate_username = UserSerializer(
            data={'username': 'SERIALIZER_USER'},
            partial=True,
        )
        duplicate_email = UserSerializer(
            data={'username': 'another_user', 'email': 'SERIALIZER@example.com'},
            partial=True,
        )

        self.assertFalse(invalid_username.is_valid())
        self.assertFalse(duplicate_username.is_valid())
        self.assertFalse(duplicate_email.is_valid())
        self.assertIn('username', invalid_username.errors)
        self.assertIn('username', duplicate_username.errors)
        self.assertIn('email', duplicate_email.errors)

    def test_profile_serializer_allows_own_email_and_rejects_duplicate_email(self):
        own_email = UserProfileSerializer(
            instance=self.user,
            data={
                'first_name': 'Ana',
                'last_name': 'Rojas',
                'email': ' SERIALIZER@EXAMPLE.COM ',
                'phone_number': '',
            },
            partial=True,
        )
        other_user = User.objects.create_user(
            username='other_serializer_user',
            email='other@example.com',
            password='secreto123',
        )
        duplicate_email = UserProfileSerializer(
            instance=self.user,
            data={'email': other_user.email},
            partial=True,
        )

        self.assertTrue(own_email.is_valid(), own_email.errors)
        self.assertEqual(own_email.validated_data['email'], 'serializer@example.com')
        self.assertEqual(own_email.validated_data['phone_number'], '')
        self.assertFalse(duplicate_email.is_valid())
        self.assertIn('email', duplicate_email.errors)
