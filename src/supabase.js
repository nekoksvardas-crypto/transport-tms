import { createClient } from "@supabase/supabase-js"

const supabaseUrl = "https://frloepxvdsqaeotsbrjc.supabase.co"

const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZybG9lcHh2ZHNxYWVvdHNicmpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODk1MzAsImV4cCI6MjA5NDE2NTUzMH0._VBt9u96NocXGYqVs3Iz6Y2bIHdE2y8ajW1P9w9Az5E"

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
)