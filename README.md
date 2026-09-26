# JML Objections

Application indépendante de formation aux objections commerciales immobilières.

## V1
- Bibliothèque d'objections vendeur
- Réponse courte
- Réponse argumentée
- Question à poser
- Erreur à éviter
- Mode entraînement vocal via Web Speech API quand le navigateur le permet
- Analyse locale simple de la réponse

## V2 — Simulateur vendeur IA
- simulator.html : interface de simulation vocale
- L'IA joue le propriétaire vendeur et adapte ses objections à la conversation
- Analyse finale de la conversation
- Score global + écoute, questionnement, reformulation, argumentation et empathie
- Points forts, axes d'amélioration, question recommandée et conseil
- Backend Node/Express dans server.js
- Modèle vocal prévu : gpt-realtime-2.1-mini
- Analyse finale prévue : gpt-5-mini

Le backend garde la clé OPENAI_API_KEY côté serveur et fournit un secret éphémère au navigateur. Ne jamais mettre la clé OpenAI dans index.html ou simulator.html.

## Déploiement Render
Le site actuel reste un Static Site via render.yaml.

Pour activer réellement le simulateur IA, créer un deuxième service Render Web Service sur le même dépôt :
- Repository : RahimBou/jml-objections
- Branch : main
- Build Command : npm install
- Start Command : npm start
- Environment Variable : OPENAI_API_KEY = ta clé OpenAI
- Aucun secret OpenAI dans le navigateur.

Le Static Site actuel n'est pas remplacé et reste disponible.

## Indépendance
Ce projet est volontairement séparé de :
- JML Prospection
- JML Estimateur

Aucune donnée DVF/DPE ni logique de prospection/estimation n'est utilisée.

## Évolution produit
La base est préparée pour évoluer vers un SaaS :
1. Simulateur vocal IA
2. Historique des sessions
3. Comptes utilisateurs
4. Limites d'utilisation
5. Abonnement et paiement
6. Espace agence / manager
7. Scénarios personnalisés

Les limites d'utilisation seront importantes pour contrôler le coût IA avant toute commercialisation.
