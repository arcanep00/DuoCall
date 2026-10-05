from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    """Handles new user registration with password confirmation."""

    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password],
    )
    password2 = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password', 'password2', 'display_name')
        extra_kwargs = {
            'email': {'required': True},
        }

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({'password': 'Passwords do not match.'})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password2')
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)   # hashes the password
        user.save()
        return user


class UserSerializer(serializers.ModelSerializer):
    """Read-only serializer — safe to send to the frontend."""

    display = serializers.ReadOnlyField()   # calls the @property on the model

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'display_name', 'display', 'is_online', 'avatar')
        read_only_fields = ('id', 'is_online')


class UserUpdateSerializer(serializers.ModelSerializer):
    """Lets the logged-in user update their own profile info."""

    class Meta:
        model = User
        fields = ('display_name', 'avatar')
