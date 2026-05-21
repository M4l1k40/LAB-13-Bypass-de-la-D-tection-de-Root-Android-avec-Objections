# LAB-13-Bypass-de-la-D-tection-de-Root-Android-avec-Objections
# LAB 13 — Bypass de la Détection de Root Android avec Objection

> **Module :** Sécurité Mobile Android  
> **Niveau :** Intermédiaire   
> **Application cible :** OWASP UnCrackable Level 1 (`owasp.mstg.uncrackable1`)

---

## Table des matières

1. [Objectifs](#objectifs)
2. [Prérequis & Environnement](#prérequis--environnement)
3. [Étape 1 — Installation et vérification](#étape-1--installation-et-vérification)
4. [Étape 2 — Préparation de l'appareil et démarrage de frida-server](#étape-2--préparation-de-lappareil-et-démarrage-de-frida-server)
5. [Étape 3 — Démarrer Objection sur l'app cible](#étape-3--démarrer-objection-sur-lapp-cible)
6. [Étape 4 — Bypass Java avec Objection](#étape-4--bypass-java-avec-objection)
7. [Étape 5 — Validation du bypass](#étape-5--validation-du-bypass)
8. [Bonus — Bypass natif avec frida-trace](#bonus--bypass-natif-avec-frida-trace)
9. [Résumé des commandes](#résumé-des-commandes)
10. [Livrables](#livrables)
11. [Troubleshooting](#troubleshooting)

---

## Objectifs

- Comprendre comment les applications Android détectent un environnement rooté.
- Utiliser **Objection** (basé sur Frida) pour désactiver la détection de root à l'exécution.
- Appliquer un hook Java pour contourner les vérifications de sécurité.
- (Bonus) Identifier et neutraliser les vérifications natives via `frida-trace`.

---

## Prérequis & Environnement

| Composant | Version utilisée |
|-----------|-----------------|
| Python | 3.11+ |
| Frida | 17.9.1 |
| Objection | 1.12.4 |
| ADB | Inclus dans Android SDK |
| Émulateur | Android 8.1.0 (API 27) rooté |
| App cible | OWASP UnCrackable Level 1 |

### Télécharger l'application cible

```
https://github.com/OWASP/owasp-mastg/tree/master/Crackmes/Android/Level_01
```

---

## Étape 1 — Installation et vérification

### 1.1 Installer Objection via pipx

```powershell
pip install --user pipx
pipx ensurepath
pipx install objection
```

> **Note :** Ouvrir un nouveau terminal après `pipx ensurepath` pour que le PATH soit pris en compte.  
> Si `objection` n'est pas reconnu, ajouter manuellement le chemin :
> ```powershell
> $env:PATH += ";C:\Users\<user>\.local\bin"
> ```

### 1.2 Vérification de l'installation

```powershell
objection --version
frida --version
adb devices
```

**Sortie attendue :**

```
objection: 1.12.4
17.9.1
List of devices attached
emulator-5554   device
```

### 1.3 Installer l'APK sur l'émulateur

```powershell
adb install UnCrackable-Level1.apk
```

---

## Étape 2 — Préparation de l'appareil et démarrage de frida-server

### 2.1 Pousser frida-server sur l'émulateur

Télécharger la version correspondant à l'architecture de l'émulateur (x86 pour AVD standard) depuis :
```
https://github.com/frida/frida/releases
```

```powershell
adb push frida-server /data/local/tmp/
adb shell "chmod 755 /data/local/tmp/frida-server"
```

### 2.2 Démarrer frida-server

```powershell
adb shell "/data/local/tmp/frida-server &"
```

### 2.3 Vérifier que frida-server tourne

```powershell
adb shell "ps | grep frida"
```

**Sortie attendue :**

```
root   9887   1  1053372  172648  poll_schedule_timeout  S  frida-server
```

### 2.4 Vérifier la visibilité de l'application

```powershell
frida-ps -Uai | findstr uncrackable
```

**Sortie attendue :**

```
12282  Uncrackable1   owasp.mstg.uncrackable1
```

---

## Étape 3 — Démarrer Objection sur l'app cible

### 3.1 Trouver le nom exact de l'activité principale

```powershell
adb shell dumpsys package owasp.mstg.uncrackable1 | findstr Activity
```

**Sortie :**

```
cf37351 owasp.mstg.uncrackable1/sg.vantagepoint.uncrackable1.MainActivity filter d878595
```

### 3.2 Lancer l'application

```powershell
adb shell am start -n owasp.mstg.uncrackable1/sg.vantagepoint.uncrackable1.MainActivity
```

### 3.3 Attacher Objection à l'application

```powershell
objection -g owasp.mstg.uncrackable1 explore
```

**Invite attendue :**

```
owasp.mstg.uncrackable1 (run) on (Android: 8.1.0) [usb] #
```

> **Stratégie alternative — Spawn (recommandée) :**  
> Si l'app se ferme avant qu'Objection puisse s'attacher, utiliser le mode spawn avec la commande de démarrage intégrée :
> ```powershell
> objection -g owasp.mstg.uncrackable1 explore --startup-command "android root disable"
> ```

---

## Étape 4 — Bypass Java avec Objection

### 4.1 Désactiver la détection de root

Dans la console Objection :

```
android root disable
```

**Sortie attendue :**

```
(agent) Registering job 522368. Name: root-detection-disable
```

### 4.2 Vérifier les jobs actifs

```
jobs list
```

### 4.3 Pourquoi cette commande fonctionne

`android root disable` hook automatiquement les méthodes Java couramment utilisées pour détecter le root, notamment :

- `RootBeer.isRooted()`
- Lecture de fichiers comme `/system/app/Superuser.apk`
- Vérification de la présence de `su` dans le PATH

---

## Étape 5 — Validation du bypass

### 5.1 Observer l'application sur l'émulateur

Après exécution du bypass :

- **Avant bypass :** L'app affiche un popup *"Root detected !"* et se ferme.
- **Après bypass :** L'app reste ouverte et affiche le champ de saisie du secret.

### 5.2 Si l'app continue de se fermer — Script Frida avancé

Créer un fichier `bypass.js` :

```javascript
Java.perform(function() {

    // Bloquer System.exit() pour empêcher la fermeture forcée
    var System = Java.use("java.lang.System");
    System.exit.implementation = function(code) {
        console.log("[*] System.exit(" + code + ") bloqué !");
    };

    // Neutraliser les méthodes de détection de root
    var RootDetection = Java.use("sg.vantagepoint.a.c");
    RootDetection.a.implementation = function() { return false; };
    RootDetection.b.implementation = function() { return false; };
    RootDetection.c.implementation = function() { return false; };

    console.log("[*] Bypass root detection OK !");
});
```

Lancer avec Frida :

```powershell
frida -U -f owasp.mstg.uncrackable1 -l bypass.js
```

**Sortie attendue dans le terminal :**

```
Spawned `owasp.mstg.uncrackable1`. Resuming main thread!
[Android Emulator 5554::owasp.mstg.uncrackable1] -> [*] Bypass root detection OK !
```

---

## Bonus — Bypass natif avec frida-trace

### Identifier les appels natifs

```powershell
frida-trace -U -f owasp.mstg.uncrackable1 -i "Java_*"
```

Ou cibler des fonctions spécifiques liées à la détection :

```powershell
frida-trace -U -f owasp.mstg.uncrackable1 -i "*root*" -i "*check*"
```

### Hook d'un appel natif identifié

Une fois la fonction native identifiée (ex: `Java_sg_vantagepoint_a_b_a`), créer un handler dans le dossier `__handlers__` généré par frida-trace :

```javascript
// __handlers__/libfoo.so/Java_sg_vantagepoint_a_b_a.js
{
  onEnter: function(args) {
    console.log("[*] Appel natif root check intercepté");
  },
  onLeave: function(retval) {
    retval.replace(0);  // Forcer le retour à 0 (false = pas de root)
    console.log("[*] Retour forcé à 0 (bypass natif)");
  }
}
```

Relancer frida-trace pour appliquer le hook :

```powershell
frida-trace -U -f owasp.mstg.uncrackable1 -i "Java_sg_vantagepoint*"
```

---

## Résumé des commandes

```powershell
# Vérification de l'environnement
objection --version
frida --version
adb devices

# Démarrage de frida-server
adb shell "/data/local/tmp/frida-server &"
adb shell "ps | grep frida"

# Lancement de l'application
adb shell am force-stop owasp.mstg.uncrackable1
adb shell am start -n owasp.mstg.uncrackable1/sg.vantagepoint.uncrackable1.MainActivity

# Objection — attach
objection -g owasp.mstg.uncrackable1 explore

# Objection — spawn avec bypass immédiat
objection -g owasp.mstg.uncrackable1 explore --startup-command "android root disable"

# Frida — bypass avancé
frida -U -f owasp.mstg.uncrackable1 -l bypass.js

# Bonus — trace native
frida-trace -U -f owasp.mstg.uncrackable1 -i "*root*"
```

---

## Livrables

| # | Exercice | Points | Livrable |
|---|----------|--------|----------|
| 1 | Preuve d'installation et de connexion | 20 pts | Capture : `objection --version`, `frida --version`, `adb devices` |
| 2 | Démarrage et visibilité | 20 pts | Capture : invite `owasp.mstg.uncrackable1 (run) on (…) [usb] #` |
| 3 | Bypass Java avec Objection | 40 pts | Captures avant/après + logs Objection montrant `root-detection-disable` |
| 4 | Bonus natif | 20 pts | Sortie `frida-trace` + handler JS neutralisant la détection |

**Total : 100 pts**

---

## Troubleshooting

| Problème | Cause probable | Solution |
|----------|---------------|----------|
| `objection` non reconnu | PATH non mis à jour | `$env:PATH += ";C:\Users\<user>\.local\bin"` |
| `Unable to find target application` | App arrêtée | Lancer l'app avec `adb shell am start` d'abord |
| `process-terminated` immédiatement | Détection native trop rapide | Utiliser le script `bypass.js` avec Frida directement |
| `frida-server` non trouvé | Mauvaise architecture | Vérifier l'arch avec `adb shell getprop ro.product.cpu.abi` |
| Deux versions Python | `python` ≠ `pip` | Utiliser `pip` (Python 3.11) pour les outils Frida/Objection |

---

> **Références :**  
> - [OWASP MASTG](https://mas.owasp.org/MASTG/)  
> - [Frida Documentation](https://frida.re/docs/home/)  
> - [Objection GitHub](https://github.com/sensepost/objection)