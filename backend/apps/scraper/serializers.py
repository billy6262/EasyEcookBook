from rest_framework import serializers

from .utils import validate_scrape_url


class ScrapeRequestSerializer(serializers.Serializer):
    url = serializers.URLField(max_length=2000)

    def validate_url(self, value):
        # Raises ValidationError (converted to DRF 400) for SSRF-unsafe URLs
        validate_scrape_url(value)
        return value


class ParsedIngredientSerializer(serializers.Serializer):
    quantity = serializers.CharField(allow_blank=True)
    unit = serializers.CharField(allow_blank=True)
    ingredient_name = serializers.CharField(allow_blank=True)
    notes = serializers.CharField(allow_blank=True)


class ScrapeResultSerializer(serializers.Serializer):
    scraped_id = serializers.IntegerField()
    title = serializers.CharField()
    description = serializers.CharField(allow_blank=True)
    prep_time = serializers.IntegerField(allow_null=True)
    cook_time = serializers.IntegerField(allow_null=True)
    servings = serializers.IntegerField(allow_null=True)
    source_url = serializers.URLField()
    cover_image_url = serializers.CharField(allow_blank=True, allow_null=True)
    ingredients = ParsedIngredientSerializer(many=True)
    steps = serializers.ListField(child=serializers.CharField())
