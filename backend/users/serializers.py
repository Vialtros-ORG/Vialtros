from rest_framework import serializers
import re
from django.contrib.auth.password_validation import validate_password as django_validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import User, Driver, Passenger, Route, Tracking, PickupStatus, RouteRating
from .utils import normalize_name, normalize_phone


PERSON_NAME_PATTERN = re.compile(r"^[^\W\d_]+(?:[ '\u2019-][^\W\d_]+)*$", re.UNICODE)
USERNAME_PATTERN = re.compile(r'^[a-z0-9][a-z0-9._-]{2,29}$')
E164_PATTERN = re.compile(r'^\+[1-9]\d{7,14}$')


def validate_person_name(value, field_label):
    normalized = normalize_name(value)
    if normalized and (
        len(normalized) < 2
        or len(normalized) > 80
        or not PERSON_NAME_PATTERN.fullmatch(normalized)
    ):
        raise serializers.ValidationError(
            f'{field_label}: usa letras, espacios, guiones o apóstrofos (2 a 80 caracteres).'
        )
    return normalized


def validate_phone_number(value, field_label):
    normalized = normalize_phone(value)
    if normalized and not E164_PATTERN.fullmatch(normalized):
        raise serializers.ValidationError(
            f'{field_label}: ingresa un número internacional válido, por ejemplo +57 300 123 4567.'
        )
    return normalized


def build_route_intermediate_stops(passengers):
    stops = []
    for passenger in passengers:
        if passenger.pickup_lat is None or passenger.pickup_lng is None:
            continue

        user = getattr(passenger, 'user', None)
        if user:
            label = user.get_full_name() or user.username
        else:
            label = f'Parada {passenger.id}'
        stops.append({
            'id': passenger.id,
            'passenger_id': passenger.id,
            'label': label,
            'address': passenger.pickup_address or label,
            'latitude': passenger.pickup_lat,
            'longitude': passenger.pickup_lng,
        })

    return sorted(stops, key=lambda stop: (stop['label'].lower(), stop['passenger_id']))


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'phone_number', 'role', 'is_active', 'is_staff')
        read_only_fields = ('is_active', 'is_staff')

    def validate_first_name(self, value):
        return validate_person_name(value, 'El nombre')

    def validate_last_name(self, value):
        return validate_person_name(value, 'El apellido')

    def validate_username(self, value):
        username = value.strip().lower()
        if not USERNAME_PATTERN.fullmatch(username):
            raise serializers.ValidationError(
                'Usa entre 3 y 30 caracteres: letras sin tildes, números, punto, guion o guion bajo.'
            )
        duplicates = User.objects.filter(username__iexact=username)
        if self.instance:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise serializers.ValidationError('Este nombre de usuario ya está registrado.')
        return username

    def validate_email(self, value):
        email = value.strip().lower()
        if not email:
            return email
        duplicates = User.objects.filter(email__iexact=email)
        if self.instance:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise serializers.ValidationError('Este correo ya está registrado.')
        return email

    def validate_phone_number(self, value):
        return validate_phone_number(value, 'El teléfono')


class RouteRatingSerializer(serializers.ModelSerializer):
    class Meta:
        model = RouteRating
        fields = ('id', 'route', 'driver', 'stars', 'comment', 'created_at')
        read_only_fields = ('id', 'driver', 'created_at')

    def validate_stars(self, value):
        if not (1 <= value <= 5):
            raise serializers.ValidationError("Las estrellas deben estar entre 1 y 5.")
        return value


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer para que el usuario actualice su propio perfil."""
    class Meta:
        model = User
        fields = ('first_name', 'last_name', 'email', 'phone_number')

    def validate_first_name(self, value):
        return validate_person_name(value, 'El nombre')

    def validate_last_name(self, value):
        return validate_person_name(value, 'El apellido')

    def validate_email(self, value):
        email = value.strip().lower()
        if not email:
            return email
        duplicates = User.objects.filter(email__iexact=email).exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise serializers.ValidationError('Este correo ya está registrado.')
        return email

    def validate_phone_number(self, value):
        return validate_phone_number(value, 'El teléfono')


class UserBasicSerializer(serializers.ModelSerializer):
    """Datos mínimos de usuario para anidar en Driver/Passenger."""
    class Meta:
        model = User
        fields = ('id', 'username', 'first_name', 'last_name', 'email', 'role')


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=12, required=False)

    class Meta:
        model = User
        fields = ('id', 'username', 'first_name', 'last_name', 'email', 'role', 'is_active', 'password')

    def validate_first_name(self, value):
        return validate_person_name(value, 'El nombre')

    def validate_last_name(self, value):
        return validate_person_name(value, 'El apellido')

    def validate_username(self, value):
        username = value.strip().lower()
        if not USERNAME_PATTERN.fullmatch(username):
            raise serializers.ValidationError(
                'Usa entre 3 y 30 caracteres: letras sin tildes, números, punto, guion o guion bajo.'
            )
        duplicates = User.objects.filter(username__iexact=username)
        if self.instance:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise serializers.ValidationError('Este nombre de usuario ya está registrado.')
        return username

    def validate_email(self, value):
        email = value.strip().lower()
        if email:
            duplicates = User.objects.filter(email__iexact=email)
            if self.instance:
                duplicates = duplicates.exclude(pk=self.instance.pk)
            if duplicates.exists():
                raise serializers.ValidationError('Este correo ya está registrado.')
        return email

    def validate_password(self, value):
        user_data = self.initial_data
        candidate = User(
            username=user_data.get('username', ''),
            first_name=user_data.get('first_name', ''),
            last_name=user_data.get('last_name', ''),
            email=user_data.get('email', ''),
        )
        try:
            django_validate_password(value, candidate)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages) from exc
        return value

    def validate_role(self, value):
        """Validar que no se cree más de un administrador."""
        # En CREATE, no permitir crear otro admin si ya existe uno
        if self.instance is None and value == 'admin':
            admin_count = User.objects.filter(role='admin').count()
            if admin_count > 0:
                raise serializers.ValidationError(
                    'Solo puede haber un administrador en el sistema.'
                )
        return value

    def validate(self, data):
        """Validar cambios de rol en UPDATE."""
        if self.instance is None and not data.get('password'):
            # La clave identifica el campo del serializer; no contiene una contraseña.
            raise serializers.ValidationError({'password': 'La contraseña es obligatoria.'})  # NOSONAR

        # En UPDATE, proteger el único admin
        if self.instance is not None:
            new_role = data.get('role', self.instance.role)
            old_role = self.instance.role
            
            # Si intenta cambiar el rol del único admin
            if old_role == 'admin' and new_role != 'admin':
                admin_count = User.objects.filter(role='admin').count()
                if admin_count == 1:
                    raise serializers.ValidationError(
                        'No se puede cambiar el rol del único administrador del sistema.'
                    )
            
            # Si intenta asignar rol admin a otro usuario
            if new_role == 'admin' and old_role != 'admin':
                admin_count = User.objects.filter(role='admin').count()
                if admin_count > 0:
                    raise serializers.ValidationError(
                        'Solo puede haber un administrador en el sistema.'
                    )
        
        return data

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class DriverSerializer(serializers.ModelSerializer):
    user_detail = UserBasicSerializer(source='user', read_only=True)

    class Meta:
        model = Driver
        fields = ('id', 'user', 'user_detail', 'license_number')

    def validate_license_number(self, value):
        license_number = re.sub(r'\s+', '', value).upper()
        if not re.fullmatch(r'[A-Z0-9.-]{4,25}', license_number):
            raise serializers.ValidationError(
                'La licencia debe tener entre 4 y 25 letras, números, puntos o guiones.'
            )
        return license_number


class PassengerSerializer(serializers.ModelSerializer):
    user_detail = UserBasicSerializer(source='user', read_only=True)
    pickup_lat = serializers.FloatField(required=False, allow_null=True, min_value=-90, max_value=90)
    pickup_lng = serializers.FloatField(required=False, allow_null=True, min_value=-180, max_value=180)

    class Meta:
        model = Passenger
        fields = ('id', 'user', 'user_detail', 'phone', 'pickup_address', 'pickup_lat', 'pickup_lng')

    def validate_phone(self, value):
        return validate_phone_number(value, 'El teléfono del pasajero')

    def validate(self, attrs):
        latitude = attrs.get('pickup_lat', getattr(self.instance, 'pickup_lat', None))
        longitude = attrs.get('pickup_lng', getattr(self.instance, 'pickup_lng', None))
        if (latitude is None) != (longitude is None):
            raise serializers.ValidationError({
                'pickup_lat': 'La latitud y la longitud deben enviarse juntas.'
            })
        return attrs


class RouteSerializer(serializers.ModelSerializer):
    driver_detail = DriverSerializer(source='driver', read_only=True)
    passenger_details = PassengerSerializer(source='passengers', many=True, read_only=True)
    passenger_count = serializers.SerializerMethodField()
    intermediate_stops = serializers.SerializerMethodField()
    origin_lat = serializers.FloatField(required=False, allow_null=True, min_value=-90, max_value=90)
    origin_lng = serializers.FloatField(required=False, allow_null=True, min_value=-180, max_value=180)
    destination_lat = serializers.FloatField(required=False, allow_null=True, min_value=-90, max_value=90)
    destination_lng = serializers.FloatField(required=False, allow_null=True, min_value=-180, max_value=180)

    class Meta:
        model = Route
        fields = ('id', 'name', 'origin', 'destination',
                  'origin_lat', 'origin_lng', 'destination_lat', 'destination_lng',
                  'driver', 'driver_detail',
                  'passengers', 'passenger_details', 'passenger_count', 'intermediate_stops',
                  'status', 'completed_at')
        read_only_fields = ('status', 'completed_at')

    def get_passenger_count(self, obj):
        return len(obj.passengers.all())

    def get_intermediate_stops(self, obj):
        passengers = obj.passengers.all()
        return build_route_intermediate_stops(passengers)

    def validate(self, attrs):
        coordinate_pairs = (
            ('origin_lat', 'origin_lng'),
            ('destination_lat', 'destination_lng'),
        )
        for latitude_field, longitude_field in coordinate_pairs:
            latitude = attrs.get(latitude_field, getattr(self.instance, latitude_field, None))
            longitude = attrs.get(longitude_field, getattr(self.instance, longitude_field, None))
            if (latitude is None) != (longitude is None):
                raise serializers.ValidationError({
                    latitude_field: 'La latitud y la longitud deben enviarse juntas.'
                })
        return attrs


class TrackingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tracking
        fields = '__all__'


class TrackingIngestSerializer(serializers.Serializer):
    route = serializers.PrimaryKeyRelatedField(queryset=Route.objects.all())
    passenger = serializers.PrimaryKeyRelatedField(
        queryset=Passenger.objects.all(),
        required=False,
        allow_null=True,
    )
    status = serializers.ChoiceField(choices=PickupStatus.choices, default=PickupStatus.NOT_PICKED)
    latitude = serializers.FloatField(min_value=-90, max_value=90)
    longitude = serializers.FloatField(min_value=-180, max_value=180)
    timestamp = serializers.DateTimeField(required=False)
    speed_kmh = serializers.FloatField(required=False, allow_null=True, min_value=0, max_value=300)
    source = serializers.CharField(required=False, allow_blank=True, max_length=64)

    def validate(self, attrs):
        route = attrs['route']
        passenger = attrs.get('passenger')

        if passenger and not route.passengers.filter(id=passenger.id).exists():
            raise serializers.ValidationError({
                'passenger': 'El pasajero no pertenece a la ruta indicada.',
            })

        return attrs

    def create(self, validated_data):
        speed_kmh = validated_data.pop('speed_kmh', None)
        source = validated_data.pop('source', '')
        tracking = Tracking.objects.create(speed_kmh=speed_kmh, **validated_data)
        tracking._ingest_meta = {
            'source': source,
        }
        return tracking
