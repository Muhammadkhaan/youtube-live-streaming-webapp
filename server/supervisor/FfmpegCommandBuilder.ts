import { EncodingMode } from '../db/schema';

export interface CommandBuilderOptions {
  inputPath: string;
  hasAudio: boolean;
  loop: boolean;
  mode: EncodingMode;
  destinations: string[]; // Fully formatted RTMP / RTMPS URLs
  customFps?: number;
  customBitrate?: string;
}

export class FfmpegCommandBuilder {
  private args: string[] = [];

  public static build(options: CommandBuilderOptions): string[] {
    const builder = new FfmpegCommandBuilder();

    // 1. Realtime input pacing
    builder.args.push('-re');

    // 2. Continuous 24/7 looping
    if (options.loop) {
      builder.args.push('-stream_loop', '-1');
    }

    // 3. Input video file
    builder.args.push('-i', options.inputPath);

    // 4. Mute video handling: If input has no audio track, synthesize silent audio so RTMP ingest never rejects it
    if (!options.hasAudio) {
      builder.args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100');
    }

    // 5. Monotonic presentation timestamps across loop boundaries
    builder.args.push('-fflags', '+genpts');

    // 6. Encoding parameters based on mode
    switch (options.mode) {
      case 'copy':
        builder.args.push('-c:v', 'copy');
        if (!options.hasAudio) {
          builder.args.push('-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-shortest');
        } else {
          builder.args.push('-c:a', 'aac', '-b:a', '128k', '-ar', '44100');
        }
        break;

      case 'transcode_1080p_high':
        builder.args.push(
          '-vf', 'scale=-2:1080',
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-b:v', '6000k',
          '-maxrate', '6500k',
          '-bufsize', '12000k',
          '-pix_fmt', 'yuv420p',
          '-r', '60',
          '-g', '120',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-ar', '48000'
        );
        break;

      case 'transcode_1080p':
        builder.args.push(
          '-vf', 'scale=-2:1080',
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-b:v', '4500k',
          '-maxrate', '5000k',
          '-bufsize', '9000k',
          '-pix_fmt', 'yuv420p',
          '-r', '30',
          '-g', '60',
          '-c:a', 'aac',
          '-b:a', '160k',
          '-ar', '44100'
        );
        break;

      case 'transcode_720p':
        builder.args.push(
          '-vf', 'scale=-2:720',
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-b:v', '2500k',
          '-maxrate', '3000k',
          '-bufsize', '6000k',
          '-pix_fmt', 'yuv420p',
          '-r', '30',
          '-g', '60',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-ar', '44100'
        );
        break;

      case 'transcode_480p':
        builder.args.push(
          '-vf', 'scale=-2:480',
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-b:v', '1200k',
          '-maxrate', '1500k',
          '-bufsize', '3000k',
          '-pix_fmt', 'yuv420p',
          '-r', '30',
          '-g', '60',
          '-c:a', 'aac',
          '-b:a', '96k',
          '-ar', '44100'
        );
        break;

      default:
        // Default safe fallback to copy
        builder.args.push('-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-ar', '44100');
        break;
    }

    // 7. Output destinations handling: Single or Multi-Destination Tee Muxer
    if (options.destinations.length > 1) {
      builder.args.push('-flags', '+global_header');
      const teeOutputs = options.destinations
        .map(dest => `[f=flv:flvflags=no_duration_filesize]${dest}`)
        .join('|');
      builder.args.push('-f', 'tee', '-map', '0:v', '-map', '0:a', teeOutputs);
    } else if (options.destinations.length === 1) {
      builder.args.push('-flvflags', 'no_duration_filesize', '-f', 'flv', options.destinations[0]);
    }

    return builder.args;
  }

  // Safe builder for RTMP destination URLs ensuring secure RTMPS port 443 where applicable
  public static buildRtmpDestination(rtmpUrl: string, streamKey: string): string {
    let url = (rtmpUrl || '').trim().replace(/\/+$/, '');
    let key = (streamKey || '').trim();

    if (key.startsWith('rtmp://') || key.startsWith('rtmps://')) {
      const parts = key.split('/');
      url = parts.slice(0, -1).join('/');
      key = parts[parts.length - 1];
    }

    // YouTube RTMPS optimization
    if (url.includes('rtmp.youtube.com') || url.includes('rtmps.youtube.com')) {
      url = url.replace('rtmp://', 'rtmps://');
      if (url.includes('b.rtmp') || url.includes('b.rtmps') || url.includes('backup=1')) {
        return `rtmps://b.rtmps.youtube.com:443/live2/${key}?backup=1`;
      }
      return `rtmps://a.rtmps.youtube.com:443/live2/${key}`;
    }

    // Facebook Live RTMPS optimization
    if (url.includes('facebook.com')) {
      if (!url.startsWith('rtmps://')) {
        url = url.replace('rtmp://', 'rtmps://');
      }
      return `${url}/${key}`;
    }

    if (url.includes('?')) {
      const [baseUrl, query] = url.split('?');
      return `${baseUrl.replace(/\/+$/, '')}/${key}?${query}`;
    }

    return `${url}/${key}`;
  }
}
