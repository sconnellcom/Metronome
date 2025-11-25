# Metronome

A full-featured JavaScript metronome with intelligent practice assistance for musicians.

## Features

### 🎵 Three Operating Modes

1. **Regular Mode** - Classic metronome with audio beep and visual pulse
2. **Silent Mode** - Visual pulse only, perfect for silent practice
3. **Auto Mode** - Intelligent practice assistant that uses device motion to detect your beats

### 🎻 Auto Mode Highlights

The Auto Mode is designed specifically for practicing violin, cello, or other acoustic instruments using motion detection:

#### Motion Detection (Accelerometer)
- **Real-time Beat Detection**: Uses your device's accelerometer to detect tapping or physical beats
- **Acceleration Visualization**: Visual meter shows how strong your motion is in real-time
- **BPM Calculation**: Automatically calculates tempo from detected motion
- **Beat Accuracy Tracking**: Shows how closely your taps match the metronome
- **Intelligent Alerting**: Only beeps when you drift off-beat, staying silent when you're on tempo
- **Adjustable Sensitivity**: Control how responsive the motion detection is

### 🎚️ Controls

- **BPM Slider**: Adjust tempo from 40 to 240 BPM
- **Sound Selector**: Choose from 6 different sound options:
  - **Beep**: Classic 1000Hz sine wave (default)
  - **Bass Drum**: Deep, punchy bass drum sound
  - **Cymbal**: Metallic cymbal crash
  - **Tock**: Wooden metronome tock sound
  - **4-Count Riff**: Bass drum on beats 1 & 3, Cymbal on beats 2 & 4
  - **8-Count Riff**: Alternating bass and cymbal over 8 beats
- **Visual Pulse**: Animated circle that pulses with the beat
- **Acceleration Meter**: Visual indicator showing motion strength in Auto Mode
- **Sensitivity Adjustment**: Control how responsive the auto mode is
- **Start/Stop**: Simple controls to begin and end practice sessions

## Getting Started

1. **Download or clone this repository**
2. **Open `index.html` in your web browser**
3. **No installation or dependencies required!**

## Usage

### Regular & Silent Modes

1. Select your desired mode (Regular or Silent)
2. Choose your preferred sound from the Sound dropdown (Regular mode only)
3. Adjust the BPM using the slider
4. Click "Start" to begin the metronome
5. Practice along with the visual pulse (and audio in Regular mode)
6. Click "Stop" when finished

### Auto Mode

1. Click the "Auto" button to switch to Auto Mode
2. Click "Start" to begin motion detection (you may be prompted to grant permissions on iOS)
3. Adjust the sensitivity slider based on your needs:
   - **Lower sensitivity (1-3)**: More forgiving timing, higher detection threshold
   - **Medium sensitivity (4-7)**: Balanced for most practice sessions
   - **Higher sensitivity (8-10)**: Strict timing, sensitive to subtle motions
4. Tap on your device or create motion to register beats
5. Watch the acceleration meter to see your motion strength in real-time
6. The status display shows real-time feedback:
   - **Detected BPM**: Shows your current tapping tempo
   - **Beat Accuracy**: Displays how closely you match the metronome
   - **Status**: Indicates if you're "On beat" or "Off beat"
7. The metronome will stay silent while you're on beat, and beep to alert you when you drift off

## Technical Details

- **Pure JavaScript**: No frameworks or build tools required
- **Web Audio API**: High-precision audio generation
- **DeviceMotion API**: Accelerometer access for beat detection
- **CSS Animations**: Smooth visual feedback
- **Responsive Design**: Works on desktop and mobile devices

## Browser Requirements

- Modern web browser with support for:
  - Web Audio API
  - DeviceMotion API (for Auto Mode)
  - ES6 JavaScript

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Tips for Best Results in Auto Mode

1. **Stable Surface**: Place your device on a stable surface or hold it firmly
2. **Clear Taps**: Make distinct tapping motions for best detection
3. **Consistent Motion**: Maintain consistent tap intensity for accurate BPM calculation
4. **Mobile Friendly**: Works best on smartphones and tablets with built-in accelerometers
5. **Watch the Meter**: Use the acceleration visualization to calibrate your tap strength
6. **Adjust Sensitivity**: Start with medium sensitivity (5) and adjust based on your motion style

## License

This project is open source and available for personal and educational use.

## Contributing

Feel free to fork this repository and submit pull requests for improvements or bug fixes.
