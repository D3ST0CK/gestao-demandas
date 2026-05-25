from rest_framework import serializers
from .models import EntradaBancoHoras


class EntradaBancoHorasSerializer(serializers.ModelSerializer):
    class Meta:
        model = EntradaBancoHoras
        fields = '__all__'
