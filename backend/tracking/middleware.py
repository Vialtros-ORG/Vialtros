import logging

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken

logger = logging.getLogger(__name__)
User = get_user_model()
JWT_SUBPROTOCOL_PREFIX = 'vialtros.jwt.'


@database_sync_to_async
def _resolve_user(token_key):
    try:
        token = AccessToken(token_key)
        user = User.objects.get(pk=token["user_id"], is_active=True)
        logger.debug("[JwtAuthMiddleware] token valido — user_id=%s username=%s", user.pk, user.username)
        return user
    except Exception as exc:
        logger.warning("[JwtAuthMiddleware] token invalido (%s)", type(exc).__name__)
        return AnonymousUser()


class JwtAuthMiddleware(BaseMiddleware):
    """Autentica WebSockets usando el subprotocolo, no la URL."""

    async def __call__(self, scope, receive, send):
        if scope.get("type") == "websocket":
            token_key = next(
                (
                    protocol[len(JWT_SUBPROTOCOL_PREFIX):]
                    for protocol in scope.get('subprotocols', [])
                    if protocol.startswith(JWT_SUBPROTOCOL_PREFIX)
                ),
                None,
            )
            path = scope.get("path", "?")
            if token_key:
                scope["user"] = await _resolve_user(token_key)
            else:
                scope["user"] = AnonymousUser()
                logger.debug("[JwtAuthMiddleware] sin token JWT en %s", path)
        return await super().__call__(scope, receive, send)
