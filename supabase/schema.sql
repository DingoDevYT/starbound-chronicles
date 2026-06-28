-- ============================================================
--  STARBOUND CHRONICLES — Supabase Schema
--  Run this entire file in: Supabase > SQL Editor > New Query
-- ============================================================

-- ─── PROFILES (extends auth.users) ───────────────────────────
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username      TEXT UNIQUE NOT NULL,
  display_name  TEXT,
  avatar_color  TEXT DEFAULT '#3a78d4',
  bio           TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CHARACTERS ──────────────────────────────────────────────
CREATE TABLE characters (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  species       TEXT NOT NULL DEFAULT 'human',
  role          TEXT,
  rank          TEXT DEFAULT 'Ensign',
  ship          TEXT,
  appearance    JSONB DEFAULT '{}',
  stats         JSONB DEFAULT '{"strength":10,"agility":10,"intellect":10,"tenacity":10,"social":10,"tech":10}',
  notes         TEXT DEFAULT '',
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CAMPAIGNS (= Ships) ──────────────────────────────────────
CREATE TABLE campaigns (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  ship_name     TEXT,
  ship_class    TEXT DEFAULT 'Frigate',
  description   TEXT DEFAULT '',
  invite_code   TEXT UNIQUE DEFAULT upper(substr(md5(random()::text), 0, 7)),
  ship_layout   JSONB DEFAULT '{"rooms":[],"walls":[],"width":20,"height":15}',
  session_notes TEXT DEFAULT '',
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CAMPAIGN MEMBERS ────────────────────────────────────────
CREATE TABLE campaign_members (
  campaign_id   UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  character_id  UUID REFERENCES characters(id) ON DELETE SET NULL,
  member_role   TEXT DEFAULT 'player',  -- 'gm' | 'player'
  joined_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (campaign_id, user_id)
);

-- ─── SHIP LOG (shared campaign notes/events) ─────────────────
CREATE TABLE ship_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  author_id     UUID NOT NULL REFERENCES profiles(id),
  content       TEXT NOT NULL,
  log_type      TEXT DEFAULT 'note',  -- 'note' | 'event' | 'combat' | 'discovery'
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
--  AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- AUTO-UPDATE updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER characters_updated_at BEFORE UPDATE ON characters
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();
CREATE TRIGGER campaigns_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- ============================================================
--  ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters       ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns        ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE ship_log         ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Profiles viewable by all"          ON profiles FOR SELECT USING (true);
CREATE POLICY "Users insert own profile"          ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile"          ON profiles FOR UPDATE USING (auth.uid() = id);

-- Characters
CREATE POLICY "Characters viewable by owner or campaign mates" ON characters FOR SELECT USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM campaign_members cm
    JOIN campaign_members me ON me.campaign_id = cm.campaign_id
    WHERE cm.character_id = characters.id AND me.user_id = auth.uid()
  )
);
CREATE POLICY "Users create own characters"       ON characters FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own characters"       ON characters FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own characters"       ON characters FOR DELETE USING (auth.uid() = user_id);

-- Campaigns
CREATE POLICY "Campaigns viewable by members"     ON campaigns FOR SELECT USING (
  auth.uid() = owner_id OR
  EXISTS (SELECT 1 FROM campaign_members WHERE campaign_id = campaigns.id AND user_id = auth.uid())
);
CREATE POLICY "Authenticated users create campaigns" ON campaigns FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update campaigns"           ON campaigns FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners delete campaigns"           ON campaigns FOR DELETE USING (auth.uid() = owner_id);

-- Campaign Members
CREATE POLICY "Members visible to fellow members" ON campaign_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM campaign_members me WHERE me.campaign_id = campaign_members.campaign_id AND me.user_id = auth.uid())
);
CREATE POLICY "Users join campaigns"              ON campaign_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users leave campaigns"             ON campaign_members FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "GM can remove members"             ON campaign_members FOR DELETE USING (
  EXISTS (SELECT 1 FROM campaigns WHERE id = campaign_id AND owner_id = auth.uid())
);

-- Ship Log
CREATE POLICY "Log visible to campaign members"   ON ship_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM campaign_members WHERE campaign_id = ship_log.campaign_id AND user_id = auth.uid())
);
CREATE POLICY "Members create log entries"        ON ship_log FOR INSERT WITH CHECK (
  auth.uid() = author_id AND
  EXISTS (SELECT 1 FROM campaign_members WHERE campaign_id = ship_log.campaign_id AND user_id = auth.uid())
);
CREATE POLICY "Authors delete own log entries"    ON ship_log FOR DELETE USING (auth.uid() = author_id);
