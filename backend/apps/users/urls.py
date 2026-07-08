from django.urls import path

from apps.users import views

urlpatterns = [
    path("profile/", views.ProfileView.as_view(), name="user-profile"),
    path(
        "invite/<str:token>/validate/",
        views.ValidateInviteView.as_view(),
        name="validate-invite",
    ),
]
