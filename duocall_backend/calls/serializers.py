from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import Call
from users.serializers import UserSerializer

User = get_user_model()


class CallSerializer(serializers.ModelSerializer):
    """Read serializer — returned to the frontend after any call action."""
    caller   = UserSerializer(read_only=True)
    receiver = UserSerializer(read_only=True)

    class Meta:
        model = Call
        fields = (
            'id', 'caller', 'receiver',
            'call_type', 'status',
            'started_at', 'ended_at',
        )
        read_only_fields = fields


class CreateCallSerializer(serializers.ModelSerializer):
    """
    Used for POST /api/calls/
    Accepts: { "receiver": <user_id> }   ← integer PK from frontend
    call_type is always 'audio' in this branch.
    """
    # PrimaryKeyRelatedField so frontend can send just the user ID
    receiver = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all()
    )

    class Meta:
        model  = Call
        fields = ('receiver',)

    def validate(self, attrs):
        request = self.context['request']
        if attrs['receiver'] == request.user:
            raise serializers.ValidationError("You cannot call yourself.")
        return attrs

    def create(self, validated_data):
        validated_data['call_type'] = 'audio'   # always audio in this branch
        return super().create(validated_data)
