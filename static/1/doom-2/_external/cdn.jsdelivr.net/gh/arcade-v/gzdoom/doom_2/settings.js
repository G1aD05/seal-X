var GZDOOMSETTINGS = {
    CLOUDSAVEURL: "",

    // --- Autoload ---
    // Example:
    //   WADURL:  "wad/doom2.wad",
    //   MODURLS: "wad/brutal.pk3, wad/myhouse.pk3"
    WADURL: "https://cdn.jsdelivr.net/gh/arcade-v/gzdoom/doom_2/doom2.wad",
    MODURLS: ""
};

window.GZDOOMSETTINGS = GZDOOMSETTINGS;

function postLoad() {
    if (window["myApp"] == null) return;

    window["myApp"].modReplacementHook = function () {

    };

    window["myApp"].gzDoomIniHook = function (text) {
        return text;
    };
}
window.postLoad = postLoad;
