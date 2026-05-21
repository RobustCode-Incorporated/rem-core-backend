# Robust-Enterprise-Management
# REM Core - Guide d'Installation Globale

Ce dépôt contient le socle technique du système **Robust Enterprise Management (REM)**.

## Prérequis
* Node.js v18 ou supérieur
* Flutter SDK (Version stable récente)
* Un compte sur [Neon.tech](https://neon.tech) pour la base de données PostgreSQL serverless.

## Configuration du Backend

1. Naviguez dans le dossier backend :
   ```bash
   cd rem-backend

# 🔐 REM Auth - Module de Sécurité & Session

Ce module contient le système complet d'authentification multi-tenant pour REM.

## Validation TDD & Lancement du Backend

1. Assurez-vous d'avoir configuré vos variables d'environnement dans le fichier `.env` :
   ```env
   JWT_SECRET=votre_cle_secrete_de_production
   DATABASE_URL=votre_lien_neon_postgresql
   
-Développer le système d'authentification TDD" query="Développe le système d'authentification complet (JWT, chiffrement des mots de passe, gestion de sessions) côté backend Node et mobile Flutter avec des tests TDD complets.
-Créer les routes et écrans du module REM Sales" query="Génère le code complet pour la création de devis/factures et la gestion du pipeline de ventes côté API et interface mobile Flutter.
-"Mettre en place la logique d'inventaire hors-ligne" query="Met en place la synchronisation locale SQLite/Hive sur Flutter pour le module REM Inventory afin de faire fonctionner le stock sans connexion internet.