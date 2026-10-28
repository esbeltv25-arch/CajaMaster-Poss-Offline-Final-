package com.cajamaster.pos;

import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.util.Arrays;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "CajaMaster_Main";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Register our custom CajaNativePlugin with Capacitor Bridge
        registerPlugin(CajaNativePlugin.class);

        super.onCreate(savedInstanceState);

        // Check if a more recent OTA bundle has been extracted in persistent storage
        try {
            File otaDir = new File(getFilesDir(), "ota_bundles");
            if (otaDir.exists() && otaDir.isDirectory()) {
                File[] bundles = otaDir.listFiles(f -> f.isDirectory() && f.getName().startsWith("v_"));
                if (bundles != null && bundles.length > 0) {
                    // Sort descending by versionCode
                    Arrays.sort(bundles, (a, b) -> {
                        int codeA = 0;
                        int codeB = 0;
                        try { codeA = Integer.parseInt(a.getName().replace("v_", "")); } catch (Exception ignored) {}
                        try { codeB = Integer.parseInt(b.getName().replace("v_", "")); } catch (Exception ignored) {}
                        return Integer.compare(codeB, codeA);
                    });

                    for (File candidate : bundles) {
                        File indexHtml = new File(candidate, "index.html");
                        if (indexHtml.exists() && indexHtml.length() > 0) {
                            Log.i(TAG, "Loading active OTA bundle: " + candidate.getAbsolutePath());
                            if (this.bridge != null) {
                                this.bridge.setServerBasePath(candidate.getAbsolutePath());
                            }
                            break;
                        }
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Notice checking dynamic OTA bundles", e);
        }

        // We deliberately keep Capacitor's default BridgeWebChromeClient untouched.
        // This ensures JavaScript confirm(), alert(), prompt(), file selection,
        // and Capacitor plugin dialogs work out-of-the-box without being swallowed.
        Log.i(TAG, "MainActivity initialized with native CajaNativePlugin registered.");
    }
}
