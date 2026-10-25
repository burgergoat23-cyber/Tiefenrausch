package com.burgergoat.arsenal;

import net.fabricmc.api.ClientModInitializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ArsenalClient implements ClientModInitializer {
	public static final String MOD_ID = "arsenal";
	public static final Logger LOG = LoggerFactory.getLogger("Arsenal");

	@Override
	public void onInitializeClient() {
		LOG.info("Arsenal geladen");
	}
}
