from rest_framework import serializers
from .models import Demanda


class DemandaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Demanda
        fields = '__all__'
        read_only_fields = ['criada_em']
