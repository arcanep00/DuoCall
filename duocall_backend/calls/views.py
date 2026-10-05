import logging
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Call
from .serializers import CallSerializer, CreateCallSerializer

logger = logging.getLogger(__name__)


class CreateCallView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        logger.info(f"CreateCall: user={request.user.username}(id={request.user.id}) data={request.data}")
        serializer = CreateCallSerializer(
            data=request.data,
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        call = serializer.save(caller=request.user, status='calling')
        logger.info(f"CreateCall: created call id={call.id}")
        return Response(CallSerializer(call).data, status=status.HTTP_201_CREATED)


class CallActionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            call = Call.objects.get(pk=pk)
        except Call.DoesNotExist:
            return Response({'error': 'Call not found.'}, status=status.HTTP_404_NOT_FOUND)

        action  = request.data.get('action')
        user    = request.user

        logger.info(
            f"CallAction: user={user.username}(id={user.id}) "
            f"call_id={pk} caller_id={call.caller_id} receiver_id={call.receiver_id} "
            f"action={action} call_status={call.status}"
        )

        if action == 'accept':
            if call.receiver_id != user.id:
                logger.warning(f"FORBIDDEN accept: user {user.id} is not receiver {call.receiver_id}")
                return Response(
                    {'error': f'Not allowed. You are user {user.id} but receiver is {call.receiver_id}'},
                    status=status.HTTP_403_FORBIDDEN,
                )
            call.status = 'accepted'
            call.save(update_fields=['status'])

        elif action == 'reject':
            if call.receiver_id != user.id:
                return Response({'error': 'Not allowed.'}, status=status.HTTP_403_FORBIDDEN)
            call.status = 'rejected'
            call.save(update_fields=['status'])

        elif action == 'end':
            if user.id not in (call.caller_id, call.receiver_id):
                return Response({'error': 'Not allowed.'}, status=status.HTTP_403_FORBIDDEN)
            call.status   = 'ended'
            call.ended_at = timezone.now()
            call.ended_by = user
            call.save(update_fields=['status', 'ended_at', 'ended_by'])

        elif action == 'ringing':
            if call.receiver_id != user.id:
                return Response({'error': 'Not allowed.'}, status=status.HTTP_403_FORBIDDEN)
            call.status = 'ringing'
            call.save(update_fields=['status'])

        else:
            return Response(
                {'error': f'Unknown action "{action}".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(CallSerializer(call).data)
