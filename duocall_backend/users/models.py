from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """
    Custom user model extending Django's built-in AbstractUser.
    Extra fields added for DuoCall:
      - display_name : shown in the UI instead of username
      - is_online    : tracks whether the user has an active WebSocket connection
      - avatar       : optional profile picture URL
    """

    display_name = models.CharField(max_length=50, blank=True)
    is_online = models.BooleanField(default=False)
    avatar = models.URLField(blank=True, default='')

    # Keep email unique — used as an optional login identifier
    email = models.EmailField(unique=True)

    def __str__(self):
        return self.username

    @property
    def display(self):
        """Return display_name if set, otherwise fall back to username."""
        return self.display_name or self.username
