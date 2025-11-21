# Metronome

A full-featured JavaScript metronome with intelligent practice assistance for musicians.

## Features

### 🎵 Three Operating Modes

1. **Regular Mode** - Classic metronome with audio beep and visual pulse
2. **Silent Mode** - Visual pulse only, perfect for silent practice
3. **Auto Mode** - Intelligent practice assistant that listens to your playing

### 🎻 Auto Mode Highlights

The Auto Mode is designed specifically for practicing violin, cello, or other acoustic instruments:

- **Real-time Beat Detection**: Uses your microphone to detect when you play
- **BPM Calculation**: Automatically calculates your playing tempo
- **Beat Accuracy Tracking**: Shows how closely you're staying on beat
- **Intelligent Alerting**: Only beeps when you drift off-beat, staying silent when you're on tempo
- **Adjustable Sensitivity**: Fine-tune detection and tolerance to match your playing style and instrument volume

### 🎚️ Controls

- **BPM Slider**: Adjust tempo from 40 to 240 BPM
- **Visual Pulse**: Animated circle that pulses with the beat
- **Sensitivity Adjustment**: Control how responsive the auto mode is
- **Start/Stop**: Simple controls to begin and end practice sessions

## Getting Started

1. **Download or clone this repository**
2. **Open `index.html` in your web browser**
3. **No installation or dependencies required!**

## Usage

### Regular & Silent Modes

1. Select your desired mode (Regular or Silent)
2. Adjust the BPM using the slider
3. Click "Start" to begin the metronome
4. Practice along with the visual pulse (and audio in Regular mode)
5. Click "Stop" when finished

### Auto Mode

1. Click the "Auto" button to switch to Auto Mode
2. Click "Start Listening" (you'll be prompted to grant microphone access)
3. Adjust the sensitivity slider based on your needs:
   - **Lower sensitivity (1-3)**: More forgiving timing, higher volume threshold
   - **Medium sensitivity (4-7)**: Balanced for most practice sessions
   - **Higher sensitivity (8-10)**: Strict timing, sensitive to quieter sounds
4. Start playing your instrument
5. Watch the status display for real-time feedback:
   - **Detected BPM**: Shows your current playing tempo
   - **Beat Accuracy**: Displays how closely you match the metronome
   - **Status**: Indicates if you're "On beat" or "Off beat"
6. The metronome will stay silent while you're on beat, and beep to alert you when you drift off

## Technical Details

- **Pure JavaScript**: No frameworks or build tools required
- **Web Audio API**: High-precision audio generation and analysis
- **MediaDevices API**: Microphone access for beat detection
- **CSS Animations**: Smooth visual feedback
- **Responsive Design**: Works on desktop and mobile devices

## Browser Requirements

- Modern web browser with support for:
  - Web Audio API
  - MediaDevices API (for Auto Mode)
  - ES6 JavaScript

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Tips for Best Results in Auto Mode

1. **Quiet Environment**: Background noise can interfere with beat detection
2. **Microphone Placement**: Position your microphone to clearly capture your instrument
3. **Start Simple**: Begin with medium sensitivity and adjust as needed
4. **Consistent Playing**: The more consistently you play, the more accurate the feedback
5. **Match the BPM**: Set the metronome to match your intended practice tempo

## License

This project is open source and available for personal and educational use.

## Contributing

Feel free to fork this repository and submit pull requests for improvements or bug fixes.
