import json
import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth.models import AnonymousUser

from users.models import Route

logger = logging.getLogger(__name__)


@database_sync_to_async
def user_can_view_route(user, route_id):
    if not user or isinstance(user, AnonymousUser) or not user.is_authenticated:
        return False
    if user.role == 'admin':
        return Route.objects.filter(pk=route_id).exists()
    if user.role == 'driver':
        return Route.objects.filter(pk=route_id, driver__user_id=user.pk).exists()
    if user.role == 'user':
        return Route.objects.filter(pk=route_id, passengers__user_id=user.pk).exists()
    return False


def user_can_view_admin_monitoring(user):
    return bool(
        user
        and getattr(user, 'is_authenticated', False)
        and getattr(user, 'role', None) == 'admin'
    )


class TrackingConsumer(AsyncWebsocketConsumer):
    """
    Consumer de solo lectura para usuarios con acceso a la ruta.
    """

    async def connect(self):
        self.route_id = self.scope["url_route"]["kwargs"].get("route_id", "?")
        self.group_name = f"tracking_{self.route_id}"
        if not await user_can_view_route(self.scope.get('user'), self.route_id):
            await self.close(code=4403)
            return
        client = self.scope.get("client", ("?", "?"))
        logger.debug(
            "[TrackingConsumer] connect — ruta=%s cliente=%s:%s",
            self.route_id, client[0], client[1],
        )

        if self.channel_layer is None:
            logger.error(
                "[TrackingConsumer] channel_layer es None. "
                "Verifica CHANNEL_LAYERS en settings.py."
            )
            await self.close(code=4500)
            return

        try:
            await self.channel_layer.group_add(self.group_name, self.channel_name)
            await self.accept()
            logger.debug(
                "[TrackingConsumer] conexion aceptada — ruta=%s grupo=%s",
                self.route_id, self.group_name,
            )
        except Exception:
            logger.exception("[TrackingConsumer] error en connect()")
            await self.close(code=4500)

    async def disconnect(self, close_code):
        logger.debug(
            "[TrackingConsumer] disconnect — ruta=%s codigo=%s",
            getattr(self, "route_id", "?"), close_code,
        )
        if self.channel_layer is not None and hasattr(self, "group_name"):
            try:
                await self.channel_layer.group_discard(self.group_name, self.channel_name)
            except Exception:
                logger.exception("[TrackingConsumer] error en disconnect()")

    async def receive(self, text_data=None, bytes_data=None):
        # Las posiciones solo pueden entrar por la API autenticada de ingestión.
        await self.close(code=4403)

    async def tracking_update(self, event):
        try:
            await self.send(text_data=json.dumps(event["data"]))
        except Exception:
            logger.exception("[TrackingConsumer] error en tracking_update()")


class AdminMonitoringConsumer(AsyncWebsocketConsumer):
    """
    Consumer del panel de administracion.
    Solo administradores autenticados pueden observar todas las rutas.
    """

    async def connect(self):
        user = self.scope.get("user")
        is_admin = user_can_view_admin_monitoring(user)
        if not is_admin:
            await self.close(code=4403)
            return
        self.group_name = "monitoring"

        logger.debug(
            "[AdminMonitoringConsumer] connect — usuario=%s admin=%s",
            getattr(user, "username", "anonimo"),
            is_admin,
        )

        if self.channel_layer is None:
            logger.error("[AdminMonitoringConsumer] channel_layer es None.")
            await self.close(code=4500)
            return

        try:
            await self.channel_layer.group_add(self.group_name, self.channel_name)
            await self.accept()
            logger.debug("[AdminMonitoringConsumer] conexion aceptada")
        except Exception:
            logger.exception("[AdminMonitoringConsumer] error en connect()")
            await self.close(code=4500)

    async def disconnect(self, close_code):
        logger.debug("[AdminMonitoringConsumer] disconnect — codigo=%s", close_code)
        if self.channel_layer is not None and hasattr(self, "group_name"):
            try:
                await self.channel_layer.group_discard(self.group_name, self.channel_name)
            except Exception:
                logger.exception("[AdminMonitoringConsumer] error en disconnect()")

    async def monitoring_event(self, event):
        payload = event.get("payload") or event.get("data") or {}
        try:
            await self.send(text_data=json.dumps(payload))
        except Exception:
            logger.exception("[AdminMonitoringConsumer] error en monitoring_event()")


class NotificationConsumer(AsyncWebsocketConsumer):
    """
    Consumer de notificaciones personalizadas.
    Requiere usuario autenticado via JWT. Cierra la conexion si es anonimo.
    """

    async def connect(self):
        user = self.scope.get("user")
        is_authenticated = bool(user and getattr(user, "is_authenticated", False))

        logger.debug(
            "[NotificationConsumer] connect — usuario=%s autenticado=%s",
            getattr(user, "username", "anonimo"), is_authenticated,
        )

        if not is_authenticated:
            logger.warning(
                "[NotificationConsumer] conexion rechazada — usuario no autenticado"
            )
            await self.close(code=4401)
            return

        if self.channel_layer is None:
            logger.error("[NotificationConsumer] channel_layer es None.")
            await self.close(code=4500)
            return

        self.user_id = user.pk
        self.group_name = f"notifications_{self.user_id}"

        try:
            await self.channel_layer.group_add(self.group_name, self.channel_name)
            await self.accept()
            logger.debug(
                "[NotificationConsumer] conexion aceptada — user_id=%s grupo=%s",
                self.user_id, self.group_name,
            )
        except Exception:
            logger.exception("[NotificationConsumer] error en connect()")
            await self.close(code=4500)

    async def disconnect(self, close_code):
        logger.debug(
            "[NotificationConsumer] disconnect — user_id=%s codigo=%s",
            getattr(self, "user_id", "?"), close_code,
        )
        if self.channel_layer is not None and hasattr(self, "group_name"):
            try:
                await self.channel_layer.group_discard(self.group_name, self.channel_name)
            except Exception:
                logger.exception("[NotificationConsumer] error en disconnect()")

    async def notification_message(self, event):
        try:
            await self.send(text_data=json.dumps(event["payload"]))
        except Exception:
            logger.exception("[NotificationConsumer] error en notification_message()")
