from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import RegisterView, LogoutView, MeView, UserListView

urlpatterns = [
    # Auth endpoints
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/',    TokenObtainPairView.as_view(), name='login'),     # returns access + refresh
    path('auth/refresh/',  TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/logout/',   LogoutView.as_view(), name='logout'),
    path('auth/me/',       MeView.as_view(), name='me'),

    # User list — who can I call?
    path('users/', UserListView.as_view(), name='user_list'),
]
