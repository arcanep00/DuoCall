from django.db import models
from django.conf import settings


class Call(models.Model):
    """
    Stores a record of every call attempt.
    Audio data is NOT stored — only metadata.
    Video call support will be added separately.
    """

    CALL_TYPE_CHOICES = [
        ('audio', 'Audio'),
        # ('video', 'Video'),  # added by video-call branch
    ]

    STATUS_CHOICES = [
        ('calling',      'Calling'),
        ('ringing',      'Ringing'),
        ('accepted',     'Accepted'),
        ('connecting',   'Connecting'),
        ('connected',    'Connected'),
        ('ended',        'Ended'),
        ('rejected',     'Rejected'),
        ('missed',       'Missed'),
        ('failed',       'Failed'),
        ('disconnected', 'Disconnected'),
    ]

    caller   = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='outgoing_calls',
    )
    receiver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='incoming_calls',
    )
    call_type  = models.CharField(max_length=10, choices=CALL_TYPE_CHOICES)
    status     = models.CharField(max_length=20, choices=STATUS_CHOICES, default='calling')
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at   = models.DateTimeField(null=True, blank=True)
    ended_by   = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='calls_ended',
    )

    class Meta:
        ordering = ['-started_at']

    def __str__(self):
        return f'{self.caller} → {self.receiver} [{self.call_type}] {self.status}'
