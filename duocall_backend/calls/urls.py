from django.urls import path
from .views import CreateCallView, CallActionView

urlpatterns = [
    path('',          CreateCallView.as_view(),  name='call_create'),
    path('<int:pk>/action/', CallActionView.as_view(), name='call_action'),
]
