from rest_framework import serializers
from .models import Demanda, Setor, Pessoa


class PessoaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pessoa
        fields = '__all__'


class SetorSerializer(serializers.ModelSerializer):
    pessoas = PessoaSerializer(many=True, read_only=True)

    class Meta:
        model = Setor
        fields = ['id', 'nome', 'pessoas']


class DemandaSerializer(serializers.ModelSerializer):
    responsavel_nome = serializers.CharField(source='responsavel.nome', read_only=True)

    class Meta:
        model = Demanda
        fields = '__all__'
        read_only_fields = ['criada_em']
