Java.perform(function() {
    
    // Empêche System.exit() de fermer l'app
    var System = Java.use("java.lang.System");
    System.exit.implementation = function(code) {
        console.log("[*] System.exit(" + code + ") bloqué !");
    };

    // Bypass root detection
    var RootDetection = Java.use("sg.vantagepoint.a.c");
    RootDetection.a.implementation = function() { return false; };
    RootDetection.b.implementation = function() { return false; };
    RootDetection.c.implementation = function() { return false; };

    console.log("[*] Bypass root detection OK !");
});