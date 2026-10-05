"""
ASGI config — handles HTTP (Django) + WebSocket (Django Channels + JWT auth)
"""

import os
import django

# Must be set and setup() called before ANY other Django imports
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'duocall_backend.settings')
django.setup()

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from duocall_backend.middleware import JwtAuthMiddleware
from calls.routing import websocket_urlpatterns

application = ProtocolTypeRouter({
    'http': get_asgi_application(),
    'websocket': JwtAuthMiddleware(
        URLRouter(websocket_urlpatterns)
    ),
})
