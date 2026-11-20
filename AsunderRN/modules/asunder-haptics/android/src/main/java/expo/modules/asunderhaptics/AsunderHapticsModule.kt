package expo.modules.asunderhaptics

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The Android half of the haptics. NOT YET BUILT OR TESTED on a real Android
 * phone (there was no Android toolchain on the Mac this was written on).
 *
 * Android has no equivalent of iOS "sharpness", so that argument is ignored.
 * Newer phones (Android 11+) have a crisp built-in "tick" that takes a
 * strength; older ones get a very short buzz instead.
 *
 * The same three functions as the iOS module:
 *   prepare()                             false if the phone has no vibration motor
 *   tick(intensity, sharpness)            a short click
 *   lock(intensity, sharpness, duration)  a longer pulse
 */
class AsunderHapticsModule : Module() {
  private val vibrator: Vibrator? by lazy {
    val context = appContext.reactContext ?: return@lazy null
    if (Build.VERSION.SDK_INT >= 31) {
      (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
    }
  }

  /** True if this phone has the crisp built-in tick. */
  private val hasTickPrimitive by lazy {
    Build.VERSION.SDK_INT >= 30 &&
      vibrator?.areAllPrimitivesSupported(VibrationEffect.Composition.PRIMITIVE_TICK) == true
  }

  override fun definition() = ModuleDefinition {
    Name("AsunderHaptics")

    Function("prepare") {
      return@Function vibrator?.hasVibrator() == true
    }

    Function("tick") { intensity: Double, _: Double ->
      if (Build.VERSION.SDK_INT >= 30 && hasTickPrimitive) {
        vibrator?.vibrate(
          VibrationEffect.startComposition()
            .addPrimitive(VibrationEffect.Composition.PRIMITIVE_TICK, intensity.toFloat().coerceIn(0f, 1f))
            .compose()
        )
      } else {
        pulse(10, intensity)
      }
    }

    Function("lock") { intensity: Double, _: Double, duration: Double ->
      pulse((duration * 1000).toLong(), intensity)
    }
  }

  /** A plain buzz of `milliseconds`, as strong as the phone allows us to ask for. */
  private fun pulse(milliseconds: Long, intensity: Double) {
    val motor = vibrator ?: return
    if (Build.VERSION.SDK_INT >= 26) {
      val amplitude =
        if (motor.hasAmplitudeControl()) (intensity * 255).toInt().coerceIn(1, 255)
        else VibrationEffect.DEFAULT_AMPLITUDE
      motor.vibrate(VibrationEffect.createOneShot(milliseconds, amplitude))
    } else {
      @Suppress("DEPRECATION")
      motor.vibrate(milliseconds)
    }
  }
}
