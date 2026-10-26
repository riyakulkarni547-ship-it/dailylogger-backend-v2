const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Create session
app.post('/api/sessions/create', async (req, res) => {
  try {
    const { passphrase } = req.body;
    const sessionCode = Math.random().toString(36).substr(2, 6).toUpperCase();
    const passphraseHash = await bcrypt.hash(passphrase, 10);

    const { data, error } = await supabase
      .from('sessions')
      .insert([{ session_code: sessionCode, passphrase_hash: passphraseHash }])
      .select();

    if (error) throw error;

    res.json({ id: data.id, session_code: sessionCode });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Register device
app.post('/api/devices/register', async (req, res) => {
  try {
    const { session_id, device_id, device_type } = req.body;

    const { data, error } = await supabase
      .from('devices')
      .insert([{ session_id, device_id, device_type }])
      .select();

    if (error) throw error;

    res.json({ success: true, device: data });
  } catch (error) {
    console.error('Error registering device:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sync clipboard
app.post('/api/clipboard/sync', async (req, res) => {
  try {
    const { device_id, session_code, clipboard_data, timestamp } = req.body;

    // Get session
    const { data: sessions, error: sessionError } = await supabase
      .from('sessions')
      .select('id')
      .eq('session_code', session_code)
      .single();

    if (sessionError) throw sessionError;

    // Insert clipboard entry
    const { data, error } = await supabase
      .from('clipboard_entries')
      .insert([{
        session_id: sessions.id,
        device_id,
        clipboard_data,
        timestamp: timestamp || Date.now()
      }])
      .select();

    if (error) throw error;

    res.json({ success: true, entry: data });
  } catch (error) {
    console.error('Error syncing clipboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get entries
app.get('/api/entries/:sessionCode', async (req, res) => {
  try {
    const { sessionCode } = req.params;

    const { data: sessions, error: sessionError } = await supabase
      .from('sessions')
      .select('id')
      .eq('session_code', sessionCode)
      .single();

    if (sessionError) throw sessionError;

    const { data: entries, error } = await supabase
      .from('clipboard_entries')
      .select('*')
      .eq('session_id', sessions.id)
      .order('timestamp', { ascending: false })
      .limit(100);

    if (error) throw error;

    res.json({ entries });
  } catch (error) {
    console.error('Error fetching entries:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 DailyLogger Backend running on port ${PORT}`);
});
