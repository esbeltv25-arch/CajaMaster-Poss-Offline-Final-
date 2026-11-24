package com.cajamaster.pos;

import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import java.io.BufferedReader;
import java.io.File;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "CajaMaster_Main";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register our custom CajaNativePlugin with Capacitor Bridge
        registerPlugin(CajaNativePlugin.class);

        super.onCreate(savedInstanceState);

        activateNewestOtaBundle();

        // We deliberately keep Capacitor's default BridgeWebChromeClient untouched.
        // This ensures JavaScript confirm(), alert(), prompt(), file selection,
        // and Capacitor plugin dialogs work out-of-the-box without being swallowed.
        Log.i(TAG, "MainActivity initialized with native CajaNativePlugin registered.");
    }

    /**
     * Loads the newest OTA bundle extracted under files/ota_bundles/v_<versionCode>,
     * but ONLY if it is newer than the web bundle shipped inside this APK.
     * Obsolete bundles (older or equal to the APK) are deleted so that a freshly
     * installed APK is never shadowed by an old OTA bundle.
     */
    private void activateNewestOtaBundle() {
        try {
            File otaDir = new File(getFilesDir(), "ota_bundles");
            if (!otaDir.exists() || !otaDir.isDirectory()) return;

            int builtInCode = readBuiltInVersionCode();
            File[] bundles = otaDir.listFiles(f -> f.isDirectory() && f.getName().startsWith("v_"));
            if (bundles == null || bundles.length == 0) return;

            // Sort descending by versionCode
            Arrays.sort(bundles, (a, b) -> Integer.compare(parseCode(b), parseCode(a)));

            File selected = null;
            for (File candidate : bundles) {
                int code = parseCode(candidate);
                File indexHtml = new File(candidate, "index.html");
                boolean valid = indexHtml.exists() && indexHtml.length() > 0;
                if (selected == null && valid && code > builtInCode) {
                    selected = candidate;
                    continue;
                }
                // Keep at most the selected bundle; remove anything older/invalid.
                if (selected != null || code <= builtInCode || !valid) {
                    Log.i(TAG, "Removing obsolete OTA bundle: " + candidate.getName());
                    deleteRecursively(candidate);
                }
            }

            if (selected != null && this.bridge != null) {
                String current = this.bridge.getServerBasePath();
                String target = selected.getAbsolutePath();
                if (!target.equals(current)) {
                    Log.i(TAG, "Loading OTA bundle " + selected.getName() + " (APK built-in code " + builtInCode + ")");
                    this.bridge.setServerBasePath(target);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Notice checking dynamic OTA bundles", e);
        }
    }

    private int parseCode(File dir) {
        try {
            return Integer.parseInt(dir.getName().replace("v_", ""));
        } catch (Exception ignored) {
            return 0;
        }
    }

    /** Reads versionCode from the web bundle packaged in the APK (assets/public/version.json). */
    private int readBuiltInVersionCode() {
        try (InputStream is = getAssets().open("public/version.json");
             BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) sb.append(line);
            return new JSONObject(sb.toString()).optInt("versionCode", 0);
        } catch (Exception e) {
            Log.w(TAG, "Could not read built-in version.json", e);
            return 0;
        }
    }

    private void deleteRecursively(File f) {
        if (f == null || !f.exists()) return;
        if (f.isDirectory()) {
            File[] children = f.listFiles();
            if (children != null) {
                for (File c : children) deleteRecursively(c);
            }
        }
        //noinspection ResultOfMethodCallIgnored
        f.delete();
    }
}
