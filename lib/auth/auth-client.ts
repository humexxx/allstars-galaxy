/**
 * Browser-side auth calls (Supabase browser client + `location`). Lives outside
 * lib/services because everything there is `server-only`.
 */

import { createClient } from "@/lib/supabase"
import type { AuthResponse } from "@supabase/supabase-js";

export class AuthService {
  static async signInWithGoogle(next?: string | null): Promise<void> {
    const supabase = createClient()
    const callback = `${location.origin}/auth/callback${
      next ? `?next=${encodeURIComponent(next)}` : ""
    }`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callback,
      },
    })

    if (error) {
      throw error
    }
  }
  
  static async loginWithPassword(email: string, password: string): Promise<AuthResponse['data']> {
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (error) {
      throw error
    }
    
    return data
  }

  static async signUpWithEmail(
    email: string,
    password: string,
    name: string,
    next?: string | null
  ): Promise<AuthResponse['data']> {
    const supabase = createClient()
    const emailRedirectTo = `${location.origin}/auth/callback${
      next ? `?next=${encodeURIComponent(next)}` : ""
    }`
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: {
          full_name: name,
        },
      },
    })

    if (error) {
      throw error
    }

    return data
  }
  
  static async resetPasswordForEmail(email: string): Promise<void> {
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?next=/update-password`,
    })
    
    if (error) {
      throw error
    }
  }

  /** Sets a new password for the signed-in user — the landing step of the
   *  reset email, which signs the user in through /auth/callback first. */
  static async updatePassword(password: string): Promise<void> {
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      throw error
    }
  }
}

