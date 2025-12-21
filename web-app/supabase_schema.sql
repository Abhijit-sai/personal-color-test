-- Create companies table
create table public.companies (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  logo_url text,
  domain text
);

-- Enable RLS for companies
alter table public.companies enable row level security;

-- Create policy to allow read access to everyone (public)
create policy "Allow public read access"
  on public.companies
  for select
  using (true);

-- Create tracking_logs table
create table public.tracking_logs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  status text not null, -- 'success', 'failed'
  model_version text,
  error_message text,
  metadata jsonb, -- store extra details like execution time, input params
  image_id text -- optional reference to stored image
);

-- Enable RLS for tracking_logs
alter table public.tracking_logs enable row level security;

-- Create policy to allow insert only by service role (backend)
-- Actually, the backend using SERVICE_ROLE_KEY bypasses RLS, so we just need to ensure public cannot write to it unrestricted.
-- We can create a policy that allows nothing for anon, effectively making it private.
create policy "Enable read access for service role only"
  on public.tracking_logs
  for all
  using (auth.role() = 'service_role');
