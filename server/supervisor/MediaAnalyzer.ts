import { execFile } from 'child_process';
import util from 'util';
import fs from 'fs';
import { MediaAssetCompatibility } from '../db/schema';
import { resolveFfprobePath } from '../utils/ffmpegPaths';

const execFilePromise = util.promisify(execFile);

export class MediaAnalyzer {
  private static cache = new Map<string, any>();

  public static async analyze(filePath: string): Promise<MediaAssetCompatibility> {
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath);
    }

    const defaultResult: MediaAssetCompatibility = {
      compatibleForCopy: false,
      recommendation: 'TRANSCODE_REQUIRED',
      reasons: ['File unanalyzed or ffprobe missing'],
    };

    if (!fs.existsSync(filePath)) {
      defaultResult.reasons = ['File does not exist on disk'];
      return defaultResult;
    }

    try {
      const ffprobeCmd = resolveFfprobePath() || 'ffprobe';
      const { stdout } = await execFilePromise(
        ffprobeCmd,
        [
          '-v', 'error',
          '-show_streams',
          '-show_format',
          '-of', 'json',
          filePath,
        ],
        { timeout: 15000 }
      );

      const data = JSON.parse(stdout);
      const vStream = data.streams?.find((s: any) => s.codec_type === 'video');
      const aStream = data.streams?.find((s: any) => s.codec_type === 'audio');

      const reasons: string[] = [];
      let isCopyCompatible = true;

      // 1. Video stream checks
      if (!vStream) {
        isCopyCompatible = false;
        reasons.push('No video stream found.');
      } else {
        const vCodec = (vStream.codec_name || '').toLowerCase();
        if (vCodec !== 'h264') {
          isCopyCompatible = false;
          reasons.push(`Video codec "${vCodec}" is not H.264 (YouTube Live expects H.264).`);
        }

        const pixFmt = (vStream.pix_fmt || '').toLowerCase();
        if (pixFmt !== 'yuv420p') {
          isCopyCompatible = false;
          reasons.push(`Pixel format "${pixFmt}" is not yuv420p (RTMP standard is 8-bit 4:2:0).`);
        }

        // Check profile
        const profile = (vStream.profile || '').toLowerCase();
        if (profile && !['baseline', 'main', 'high'].some(p => profile.includes(p))) {
          isCopyCompatible = false;
          reasons.push(`Profile "${vStream.profile}" may not be standard for RTMP.`);
        }

        // FPS check
        if (vStream.r_frame_rate) {
          const parts = vStream.r_frame_rate.split('/');
          const fps = parts.length === 2 ? parseFloat(parts[0]) / parseFloat(parts[1]) : parseFloat(parts[0]);
          if (fps > 60.5) {
            isCopyCompatible = false;
            reasons.push(`Frame rate ${Math.round(fps)} fps exceeds YouTube recommended 60 fps.`);
          }
        }
      }

      // 2. Audio stream checks
      if (aStream) {
        const aCodec = (aStream.codec_name || '').toLowerCase();
        if (aCodec !== 'aac') {
          isCopyCompatible = false;
          reasons.push(`Audio codec "${aCodec}" is not AAC (YouTube Live standard).`);
        }

        const sampleRate = parseInt(aStream.sample_rate || '0', 10);
        if (sampleRate !== 44100 && sampleRate !== 48000) {
          isCopyCompatible = false;
          reasons.push(`Audio sample rate ${sampleRate} Hz differs from standard 44.1 kHz / 48 kHz.`);
        }

        const channels = parseInt(aStream.channels || '0', 10);
        if (channels > 2) {
          isCopyCompatible = false;
          reasons.push(`Audio has ${channels} channels (stereo 2.0 recommended for RTMP).`);
        }
      } else {
        // No audio: requires synthesis during stream copy
        reasons.push('No native audio track found (silence will be synthesized).');
      }

      const durationSeconds = data.format?.duration ? parseFloat(data.format.duration) : 0;
      const vBitrate = data.format?.bit_rate ? Math.round(parseInt(data.format.bit_rate, 10) / 1000) : undefined;

      const result: MediaAssetCompatibility = {
        compatibleForCopy: isCopyCompatible,
        recommendation: isCopyCompatible ? 'STREAM_COPY' : 'TRANSCODE_REQUIRED',
        reasons: reasons.length > 0 ? reasons : ['Compatible with YouTube Live RTMP ingest'],
        videoCodec: vStream?.codec_name,
        profile: vStream?.profile,
        pixelFormat: vStream?.pix_fmt,
        audioCodec: aStream?.codec_name,
        audioSampleRate: aStream?.sample_rate ? parseInt(aStream.sample_rate, 10) : undefined,
        audioChannels: aStream?.channels,
        width: vStream?.width,
        height: vStream?.height,
        fps: vStream?.r_frame_rate ? (() => {
          const parts = vStream.r_frame_rate.split('/');
          const num = parseFloat(parts[0]);
          const den = parseFloat(parts[1]);
          return den > 0 ? Math.round(num / den) : (Math.round(num) || 30);
        })() : 30,
        bitrate: vBitrate,
        durationSeconds,
      };

      this.cache.set(filePath, result);
      return result;
    } catch (err: any) {
      defaultResult.reasons = [`Analysis error: ${err.message}`];
      return defaultResult;
    }
  }
}
