# Supabase local setup (Windows 11)

## 1. Docker Desktop

Install from docker.com/products/docker-desktop, restart, open it and leave
it running. Check:

```powershell
docker --version
docker ps
```

`docker ps` should print an empty table, not an error.

## 2. Supabase CLI

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
supabase --version
```

## 3. Log in and link

```powershell
supabase login
cd <path to>\LIEBP_Platform
supabase link --project-ref YOUR_REF_HERE
```

The ref is the last segment of the dashboard URL
(`supabase.com/dashboard/project/<ref>`). The password it asks for is the
database password, not your account password.

## 4. Start the local stack

```powershell
supabase start
```

First run downloads several GB of images. It prints local URLs and keys;
copy them into `.env`.

## 5. Test migrations

```powershell
supabase db reset
```

Wipes the **local** database and replays every migration. Run it after every
new migration. CI runs the same command on every PR.

## 6. Push to hosted

```powershell
supabase db push
```

Only from `main`, only after a release PR has merged.

## Two commands to be careful with

- `supabase db reset --linked` wipes the **hosted** database. Never use it.
- `supabase db push` changes the real database.

## Stopping

```powershell
supabase stop
```
