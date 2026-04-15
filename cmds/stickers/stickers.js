import axios from 'axios';
import fs from 'fs';
import { spawn } from 'child_process';
import webpmux from 'node-webpmux';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const toBuffer = async (url) => Buffer.from((await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 })).data);

const toWebp = (buffer, isAnimated = false) => new Promise((resolve, reject) => {
  const tmpIn = `./tmp/spack-in-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const tmpOut = `./tmp/spack-out-${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
  fs.writeFileSync(tmpIn, buffer);
  const vf = 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,format=rgba,format=yuva420p';
  const codec = isAnimated ? 'libwebp_anim' : 'libwebp';
  const args = ['-y', '-i', tmpIn, '-vf', vf, '-c:v', codec, '-q:v', '50', '-compression_level', '6'];
  if (isAnimated) args.push('-loop', '0');
  args.push(tmpOut);
  const p = spawn('ffmpeg', args);
  p.on('close', (code) => {
    try { fs.unlinkSync(tmpIn); } catch {}
    if (code === 0 && fs.existsSync(tmpOut)) {
      const result = fs.readFileSync(tmpOut);
      try { fs.unlinkSync(tmpOut); } catch {}
      resolve(result);
    } else {
      reject(new Error('ffmpeg failed'));
    }
  });
});

const isStickerUrl = (url) => /^(https?:\/\/)?(www\.)?sticker\.ly\/s\/[a-zA-Z0-9]+$/i.test(url);

const searchPacks = async (query, attempt = 1) => {
  try {
    const { data } = await axios.get('https://api.stellarwa.xyz/stickerly/search', { params: { query, key: 'YukiWaBot' }, timeout: 10000 });
    return data;
  } catch (e) {
    if (e.response?.status === 429 && attempt <= 3) { await delay((e.response.headers['retry-after'] || 5) * 1000); return searchPacks(query, attempt + 1); }
    throw e;
  }
};

const downloadPack = async (url, attempt = 1) => {
  try {
    const { data } = await axios.get('https://api.stellarwa.xyz/stickerly/detail', { params: { url, key: 'YukiWaBot' }, timeout: 10000 });
    return data;
  } catch (e) {
    if (e.response?.status === 429 && attempt <= 3) { await delay((e.response.headers['retry-after'] || 5) * 1000); return downloadPack(url, attempt + 1); }
    if (e.response?.status === 500) return { status: false, error: 500 };
    throw e;
  }
};

const filterRelevantPacks = (packs, query) => {
  const searchTerm = query.toLowerCase().trim();
  if (!searchTerm) return packs;
  return packs.filter(pack => (pack.name || '').toLowerCase().includes(searchTerm));
};

export default {
  command: ['stickerpack', 'spack', 'stickers'],
  category: 'stickers',
  run: async (client, m, args, usedPrefix, command, text) => {
    try {
      if (!text) return client.reply(m.chat, `《✧》 Ingresa un texto para buscar packs de stickers o una URL de sticker.ly.`, m);
      await m.react('🕒');
      const db = global.db.data;
      const user = db.users[m.sender] || {};
      const name = user.name || m.sender.split('@')[0];
      let packData;
      const stickerMatch = text.match(/(?:sticker\.ly\/s\/)([a-zA-Z0-9]+)(?:\s|$)/);
      const url = stickerMatch ? 'https://sticker.ly/s/' + stickerMatch[1] : (isStickerUrl(text) ? text : null);
      if (url) {
        const detail = await downloadPack(url);
        if (!detail || !detail.status || detail.error === 500) return client.reply(m.chat, `《✧》 El pack de la URL no está disponible o es privado.`, m);
        if (!detail.detalles) return client.reply(m.chat, `《✧》 No se pudo obtener el pack desde la URL.`, m);
        packData = detail.detalles;
      } else {
        const search = await searchPacks(text);
        if (!search.status || !search.resultados?.length) return client.reply(m.chat, `《✧》 No se encontraron packs para *${text}*.`, m);
        const relevantPacks = filterRelevantPacks(search.resultados, text);
        const packsToTry = relevantPacks.length > 0 ? relevantPacks : search.resultados;
        let detail = null;
        let intentos = 0;
        const maxIntentos = Math.min(packsToTry.length, 5);
        const indices = [...Array(packsToTry.length).keys()];
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        while (intentos < maxIntentos && !detail) {
          const res = await downloadPack(packsToTry[indices[intentos]].url);
          if (res?.status && res?.detalles?.stickers?.length > 0) detail = res.detalles;
          intentos++;
        }
        if (!detail) return client.reply(m.chat, `《✧》 No se pudo descargar ningún pack válido.`, m);
        packData = detail;
      }
      const { name: packName, author, stickers, thumbnailUrl } = packData;
      if (!stickers?.length) return client.reply(m.chat, `《✧》 El pack no contiene stickers válidos.`, m);
      const MAX_STICKERS = 50;
      const selectedStickers = stickers.slice(0, MAX_STICKERS);
      const [cover, stickerResults] = await Promise.all([
        (async () => {
          try {
            const buf = await toBuffer(thumbnailUrl);
            const converted = await toWebp(buf, false);
            const img = new webpmux.Image();
            await img.load(converted);
            return await img.save(null);
          } catch {
            return Buffer.alloc(0);
          }
        })(),
        Promise.all(selectedStickers.map(async (s) => {
          try {
            const buffer = await toBuffer(s.imageUrl);
            const sticker = await toWebp(buffer, s.isAnimated || false);
            const img = new webpmux.Image();
            await img.load(sticker);
            const result = await img.save(null);
            return { sticker: result, isAnimated: s.isAnimated || false, isLottie: false, emojis: ['🎭'] };
          } catch {
            return null;
          }
        })).then(results => results.filter(r => r !== null))
      ]);
      if (!stickerResults.length) return client.reply(m.chat, `《✧》 No se pudieron procesar los stickers del pack.`, m);
      await client.sendMessage(m.chat, { stickerPack: { name: packName, publisher: author?.name || author?.username || `@${name}`, description: 'ʏᴜᴋɪ 🧠 Wᴀʙᴏᴛ', cover, stickers: stickerResults } }, { quoted: m });
      await m.react('✔️');
    } catch (e) {
      await m.react('✖️');
      return m.reply(`> An unexpected error occurred while executing command *${usedPrefix + command}*. Please try again or contact support if the issue persists.\n> [Error: *${e.message}*]`);
    }
  }
};