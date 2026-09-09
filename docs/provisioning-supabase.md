# Provisioning Supabase — RIF-App

Action utilisateur (DECISIONS.md D-02/D-03) : je ne crée ni ne manipule le compte,
le projet ou les identifiants Supabase du client — jamais de clé tapée par moi
dans un champ. Ce document est le mode d'emploi exact pour le faire toi-même,
en une seule session. Compte ~15 minutes.

## 1. Créer le projet

1. https://supabase.com/dashboard → New project.
2. Organisation : celle d'Alpha No_Code (ou celle du client, selon qui doit
   payer/administrer — à trancher avec lui si ce n'est pas déjà clair).
3. Nom : `rif-app` (ou équivalent). Région : la plus proche de Biarritz
   (`eu-west-3` Paris si disponible, sinon `eu-central-1`).
4. Mot de passe de la base : généré par Supabase ou par toi, peu importe —
   il ne sert qu'à la connexion Postgres directe (jamais utilisé par
   l'application, qui passe par l'API). Note-le dans ton gestionnaire de
   secrets, pas dans ce dépôt.
5. Attendre la fin du provisioning (1-2 minutes).

## 2. Récupérer les clés

Dans le projet → **Settings → API** :

| Valeur affichée | Variable d'environnement | Où la mettre |
|---|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` + Vercel |
| `anon` `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` + Vercel |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` + Vercel (jamais côté client) |

Copie ces trois valeurs directement depuis le Dashboard vers ton fichier
`.env.local` (non commité, voir `.gitignore`) et vers les Environment
Variables du projet Vercel. Je n'ai pas besoin de les voir passer.

## 3. Exécuter le schéma

**Dashboard → SQL Editor → New query**, coller le contenu de
[`supabase/schema-rif-app.sql`](../supabase/schema-rif-app.sql) en entier, **Run**.

Ce script crée les 5 tables applicatives (`profiles`, `dossiers`, `files`,
`generations`, `quality_audits`, `events`), active la RLS sur chacune avec
les policies propriétaire/supervision, **et** crée le bucket de stockage
privé `rif-app-sources` avec ses policies (`storage.objects`) — tout est
dans ce fichier, aucune étape manuelle supplémentaire côté Storage.

Ne pas exécuter `supabase/schema.sql` : c'est l'ancien schéma V2 abandonné
(DECISIONS.md D-14), conservé en lecture seule à titre historique — un
projet neuf n'en a aucun besoin.

Si le bucket doit porter un autre nom que `rif-app-sources` : adapter le nom
dans le script SQL **et** définir `SUPABASE_STORAGE_BUCKET` dans les mêmes
env vars que ci-dessus.

## 4. Créer les deux comptes

L'application n'a pas de page d'inscription (PRD §17 : authentification
individuelle, pas d'auto-inscription publique). Les comptes se créent côté
Supabase :

**Dashboard → Authentication → Users → Add user → Create new user.**

1. Compte réel d'Évariste : son email, un mot de passe que tu lui
   transmets par un canal séparé (jamais dans ce dépôt ni dans cette
   conversation). Coche "Auto Confirm User" pour éviter l'email de
   confirmation.
2. Compte de supervision Alpha_no_code : même procédure, avec l'email de
   l'agence.

Puis, dans **SQL Editor**, donner le rôle de supervision au second compte
(remplacer l'email) :

```sql
insert into profiles (id, role)
select id, 'supervisor' from auth.users where email = 'email-alpha-no-code@...'
on conflict (id) do update set role = 'supervisor';
```

Le compte d'Évariste n'a besoin d'aucune ligne dans `profiles` : le rôle
`client` n'y est vérifié nulle part, seul `owner_id = auth.uid()` gouverne
son accès à ses propres dossiers.

## 5. Vérifier

```bash
npm run dev
```

Se connecter avec le compte d'Évariste sur `/connexion`, créer un dossier,
déposer une source. Un échec à cette étape avec une erreur de permission
(403/`new row violates row-level security policy`) signale presque
toujours une policy Storage manquante — revérifier l'étape 3.

## 6. Vercel

Dans le projet Vercel (Settings → Environment Variables), ajouter les six
variables de `.env.example` (les trois Supabase ci-dessus + `ANTHROPIC_API_KEY`,
`FAL_KEY`, `SUPABASE_STORAGE_BUCKET` si non par défaut) pour les
environnements Production et Preview. Redéployer.
