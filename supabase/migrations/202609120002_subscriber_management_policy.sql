create policy "Authenticated users can manage subscribers"
  on subscribers for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
