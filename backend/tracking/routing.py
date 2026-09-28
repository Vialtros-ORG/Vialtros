from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from django.urls import re_path

from tracking import consumers
from tracking.middleware import JwtAuthMiddleware

def create_application(django_application):
    return ProtocolTypeRouter({
        "http": django_application,
        "websocket": AuthMiddlewareStack(
            JwtAuthMiddleware(
                URLRouter([
                    re_path(r"^ws/tracking/(?P<route_id>\d+)/$", consumers.TrackingConsumer.as_asgi()),
                    re_path(r"^ws/monitoring/$", consumers.AdminMonitoringConsumer.as_asgi()),
                    re_path(r"^ws/notifications/$", consumers.NotificationConsumer.as_asgi()),
                ])
            )
        ),
    })
