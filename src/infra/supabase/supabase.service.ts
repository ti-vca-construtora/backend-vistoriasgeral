import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private adminClient: SupabaseClient;
  private anonClient: SupabaseClient;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('SUPABASE_URL');
    const serviceKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = this.config.get<string>('SUPABASE_ANON_KEY');

    if (!url || !serviceKey || !anonKey) {
      throw new Error('Supabase env vars not set');
    }

    // 🔥 Admin (poder total)
    this.adminClient = createClient(url, serviceKey);

    // 🔐 Auth / validação JWT
    this.anonClient = createClient(url, anonKey);
  }

  getAdmin(): SupabaseClient {
    return this.adminClient;
  }

  getAnon(): SupabaseClient {
    return this.anonClient;
  }
}
