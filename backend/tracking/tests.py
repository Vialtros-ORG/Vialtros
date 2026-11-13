from asgiref.sync import async_to_sync
from django.contrib.auth.models import AnonymousUser
from django.test import TransactionTestCase
from rest_framework_simplejwt.tokens import AccessToken
from unittest.mock import AsyncMock

from users.models import Driver, Passenger, Route, User
from .consumers import TrackingConsumer, user_can_view_admin_monitoring, user_can_view_route
from .middleware import JWT_SUBPROTOCOL_PREFIX, JwtAuthMiddleware, _resolve_user


class TrackingSocketAuthorizationTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.admin = User.objects.create_user(username='ws_admin', password='secreto123', role='admin')
        self.driver_user = User.objects.create_user(username='ws_driver', password='secreto123', role='driver')
        self.driver = Driver.objects.create(user=self.driver_user, license_number='WS-001')
        self.passenger_user = User.objects.create_user(username='ws_passenger', password='secreto123', role='user')
        self.passenger = Passenger.objects.create(user=self.passenger_user, phone='3000000000')
        other_driver_user = User.objects.create_user(username='ws_other_driver', password='secreto123', role='driver')
        other_driver = Driver.objects.create(user=other_driver_user, license_number='WS-002')
        self.route = Route.objects.create(
            name='Ruta asignada', origin='Centro', destination='Colegio', driver=self.driver,
        )
        self.route.passengers.add(self.passenger)
        self.other_route = Route.objects.create(
            name='Ruta ajena', origin='Puerto', destination='Terminal', driver=other_driver,
        )

    def test_tracking_socket_requires_route_assignment(self):
        can_view = async_to_sync(user_can_view_route)

        self.assertFalse(can_view(AnonymousUser(), self.route.pk))
        self.assertTrue(can_view(self.admin, self.route.pk))
        self.assertTrue(can_view(self.driver_user, self.route.pk))
        self.assertTrue(can_view(self.passenger_user, self.route.pk))
        self.assertFalse(can_view(self.driver_user, self.other_route.pk))
        self.assertFalse(can_view(self.passenger_user, self.other_route.pk))

    def test_monitoring_socket_is_admin_only(self):
        self.assertTrue(user_can_view_admin_monitoring(self.admin))
        self.assertFalse(user_can_view_admin_monitoring(self.driver_user))
        self.assertFalse(user_can_view_admin_monitoring(self.passenger_user))
        self.assertFalse(user_can_view_admin_monitoring(AnonymousUser()))

    def test_jwt_authentication_accepts_only_active_users(self):
        inactive_user = User.objects.create_user(
            username='ws_inactive', password='secreto123', role='user', is_active=False,
        )

        active_result = async_to_sync(_resolve_user)(str(AccessToken.for_user(self.admin)))
        inactive_result = async_to_sync(_resolve_user)(str(AccessToken.for_user(inactive_user)))

        self.assertEqual(active_result.pk, self.admin.pk)
        self.assertIsInstance(inactive_result, AnonymousUser)

    def test_jwt_subprotocol_authenticates_active_user(self):
        observed = {}
        token = str(AccessToken.for_user(self.admin))

        async def capture_scope(scope, receive, send):
            observed['user'] = scope['user']

        middleware = JwtAuthMiddleware(capture_scope)
        async_to_sync(middleware)(
            {
                'type': 'websocket',
                'subprotocols': ['vialtros', f'{JWT_SUBPROTOCOL_PREFIX}{token}'],
            },
            None,
            None,
        )

        self.assertEqual(observed['user'].pk, self.admin.pk)

    def test_websocket_without_jwt_does_not_reuse_session_user(self):
        scope_user = User.objects.create_user(
            username='ws_session_user', password='secreto123', role='user', is_active=False,
        )
        observed = {}

        async def capture_scope(scope, receive, send):
            observed['user'] = scope['user']

        middleware = JwtAuthMiddleware(capture_scope)
        async_to_sync(middleware)(
            {'type': 'websocket', 'subprotocols': [], 'user': scope_user},
            None,
            None,
        )

        self.assertIsInstance(observed['user'], AnonymousUser)

    def test_tracking_websocket_rejects_client_messages(self):
        consumer = TrackingConsumer()
        consumer.close = AsyncMock()

        async_to_sync(consumer.receive)(text_data='{"latitude": 3.45, "longitude": -76.53}')

        consumer.close.assert_awaited_once_with(code=4403)
