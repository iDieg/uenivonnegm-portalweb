// Validación mediante Supabase Auth
const { data, error } = await supabase.auth.signInWithPassword({
  email: email,
  password: password,
});
if (!error) window.location.href = 'dashboard.html';