import axios from 'axios';
import { promises as fs } from 'fs';

const FILE_PATH = './core/characters.json';
const rollLocks = new Map();

function cleanOldLocks() {
  const now = Date.now();
  for (const [userId, lockTime] of rollLocks.entries()) {
    if (now - lockTime > 30000) {
      rollLocks.delete(userId);
    }
  }
}

async function loadCharacters() {
  try {
    await fs.access(FILE_PATH);
  } catch {
    await fs.writeFile(FILE_PATH, '{}');
  }
  const raw = await fs.readFile(FILE_PATH, 'utf-8');
  return JSON.parse(raw);
}

function flattenCharacters(db) {
  return Object.values(db).flatMap(s => Array.isArray(s.characters) ? s.characters : []);
}

function getSeriesNameByCharacter(db, id) {
  return Object.entries(db).find(([, serie]) => Array.isArray(serie.characters) && serie.characters.some(c => String(c.id) === String(id)))?.[1]?.name || 'Desconocido';
}

function formatTag(tag) {
  return String(tag).trim().toLowerCase().replace(/\s+/g, '_');
}

function getRefererForUrl(url) {
  if (url.includes('safebooru.org')) return 'https://safebooru.org/';
  if (url.includes('danbooru.donmai.us')) return 'https://danbooru.donmai.us/';
  if (url.includes('gelbooru.com')) return 'https://gelbooru.com/';
  return '';
}

async function buscarImagenDelirius(tag) {
  const query = formatTag(tag);
  const sources = [
    { url: `https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&tags=${query}&limit=100`, extract: (data) => {
        const posts = Array.isArray(data) ? data : data?.post || [];
        return posts.map(i => i?.file_url || (i?.directory && i?.image ? `https://safebooru.org/images/${i.directory}/${i.image}` : null)).filter(u => typeof u === 'string' && /\.(jpe?g|png)(\?.*)?$/i.test(u));
    }},
    { url: `https://danbooru.donmai.us/posts.json?tags=${query}&limit=100`, extract: (data) => {
        const posts = Array.isArray(data) ? data : [];
        return posts.map(i => i?.file_url || i?.large_file_url).filter(u => typeof u === 'string' && /\.(jpe?g|png)(\?.*)?$/i.test(u));
    }},
    { url: `https://gelbooru.com/index.php?page=dapi&s=post&q=index&json=1&tags=${query}&limit=100&api_key=98f554258c88c44f4dd28ccde0c28f36682b2a992490ab35ebcc7baf7e196a86d7550b174bce577b8cc3f544e9b3ad0f6aeb09ad63bf89a9141cc3eddb6fbfd2&user_id=1917269`, extract: (data) => {
        const posts = Array.isArray(data) ? data : data?.post || data?.data || [];
        return posts.map(i => i?.file_url).filter(u => typeof u === 'string' && /\.(jpe?g|png)(\?.*)?$/i.test(u));
    }}
  ];
  const results = await Promise.allSettled(sources.map(async (source) => {
    const res = await axios.get(source.url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }, timeout: 8000 });
    return source.extract(res.data);
  }));
  const allUrls = results.filter(r => r.status === 'fulfilled' && r.value.length > 0).flatMap(r => r.value);
  return [...new Set(allUrls)];
}

export default {
  command: ['rollwaifu', 'rw', 'roll'],
  category: 'gacha',
  run: async (client, m, args, usedPrefix, command) => {
    const userId = m.sender;
    const chatId = m.chat;
    cleanOldLocks();
    if (rollLocks.has(userId)) {
      const lockTime = rollLocks.get(userId);
      const now = Date.now();
      if (now - lockTime < 15000) return;
      rollLocks.delete(userId);
    }
    const chats = global.db.data.chats;
    const chat = chats[chatId];
    if (chat.adminonly || !chat.gacha) {
      return m.reply(`ꕥ Los comandos de *Gacha* están desactivados en este grupo.\n\nUn *administrador* puede activarlos con el comando:\n» *${usedPrefix}gacha on*`);
    }
    if (!chat.users) chat.users = {};
    if (!chat.users[userId]) chat.users[userId] = {};
    if (!chat.characters) chat.characters = {};
    chat.rolls ||= {};
    const me = chat.users[userId];
    const now = Date.now();
    const cooldown = 15 * 60 * 1000;
    if (me.lastRoll && now < me.lastRoll) {
      const r = Math.ceil((me.lastRoll - now) / 1000);
      const min = Math.floor(r / 60);
      const sec = r % 60;
      let timeText = '';
      if (min > 0) timeText += `${min} minuto${min !== 1 ? 's' : ''} `;
      if (sec > 0 || timeText === '') timeText += `${sec} segundo${sec !== 1 ? 's' : ''}`;
      return m.reply(`ꕥ Debes esperar *${timeText.trim()}* para usar *${usedPrefix + 'rw'}* de nuevo.`);
    }
    rollLocks.set(userId, now);
    try {
      const db = await loadCharacters();
      const all = flattenCharacters(db);
      const selected = all[Math.floor(Math.random() * all.length)];
      const id = String(selected.id);
      const source = getSeriesNameByCharacter(db, selected.id);
      const baseTag = formatTag(selected.tags?.[0] || '');
      const mediaList = await buscarImagenDelirius(baseTag);
      const media = mediaList[Math.floor(Math.random() * mediaList.length)];
      if (!media) {
        rollLocks.delete(userId);
        return m.reply(`ꕥ No se encontró imágenes para el personaje *${selected.name}*.`);
      }
      if (!chat.characters[selected.id]) chat.characters[selected.id] = {};
      const record = chat.characters[selected.id];
      const globalRec = global.db.data.characters?.[selected.id] || {};
      record.name = String(selected.name || 'Sin nombre');
      record.value = typeof globalRec.value === 'number' ? globalRec.value : Number(selected.value) || 100;
      record.votes = Number(record.votes || globalRec.votes || 0);
      record.reservedBy = userId;
      record.reservedUntil = now + 20000;
      record.expiresAt = now + 60000;
      const owner = typeof record?.user === 'string' && record.user.length ? (global.db.data.users?.[record.user]?.name || record.user.split('@')[0]).trim() : 'desconocido';
      const msg = `❀ Nombre » *${record.name}*\n⚥ Género » *${selected.gender || 'Desconocido'}*\n✰ Valor » *${record.value.toLocaleString()}*\n♡ Estado » *${record.user ? `Reclamado por ${owner}` : 'Libre'}*\n❖ Fuente » *${source}*`;
      const imgRes = await axios.get(media, { responseType: 'arraybuffer', timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Referer': getRefererForUrl(media) } });
      const buffer = Buffer.from(imgRes.data);
      const sent = await client.sendMessage(chatId, { image: buffer, caption: msg }, { quoted: m });
      chat.rolls[sent.key.id] = { id, name: record.name, expiresAt: record.expiresAt, reservedBy: userId, reservedUntil: record.reservedUntil };
      me.lastRoll = now + cooldown;
    } catch (e) {
      await m.reply(`> An unexpected error occurred while executing command *${usedPrefix + command}*. Please try again or contact support if the issue persists.\n> [Error: *${e.message}*]`);
    } finally {
      rollLocks.delete(userId);
    }
  }
};