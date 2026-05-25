from django.db import models


class EntradaBancoHoras(models.Model):
    TIPO_CHOICES = [
        ('credito', 'Crédito'),
        ('debito', 'Débito'),
    ]

    data = models.DateField()
    horas = models.DecimalField(max_digits=4, decimal_places=2)
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    descricao = models.CharField(max_length=200)

    class Meta:
        ordering = ['-data']

    def __str__(self):
        return f"{self.tipo} {self.horas}h — {self.data}"


class Configuracao(models.Model):
    jornada_diaria_horas = models.DecimalField(max_digits=4, decimal_places=2, default=8.0)

    class Meta:
        verbose_name = 'Configuração'

    def __str__(self):
        return f"Jornada: {self.jornada_diaria_horas}h"
