const SUPABASE_URL = "https://amqzikqtsvtbqluibkzo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtcXppa3F0c3Z0YnFsdWlia3pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4OTUwMjgsImV4cCI6MjEwNDQ3MTAyOH0.S8QxWMwEw4lnLkDBlKCgzayf_IpenTNegGxuccaUdlc";

window.adyGuessrSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
	auth: {
		persistSession: false,
		autoRefreshToken: false,
		detectSessionInUrl: false
	}
});
