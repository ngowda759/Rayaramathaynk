"use client";

/**
 * LocationButton Component
 * Button that shows distance to temple and opens navigation
 */

import { useState } from "react";
import { useLocation } from "@/lib/device/hooks";
import { MapPin, Navigation, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LocationButtonProps {
  showDistance?: boolean;
  showETA?: boolean;
  variant?: "primary" | "outline" | "ghost";
  size?: "default" | "sm" | "icon" | "icon-sm";
  className?: string;
  autoFetch?: boolean;
}

export function LocationButton({
  showDistance = true,
  showETA = false,
  variant = "outline",
  size = "sm",
  className = "",
  autoFetch = false,
}: LocationButtonProps) {
  const location = useLocation({ watchPosition: false });
  const [isFetching, setIsFetching] = useState(false);

  const handleGetLocation = async () => {
    setIsFetching(true);
    await location.getCurrentLocation();
    setIsFetching(false);
  };

  const hasDistance = location.distanceToTemple !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={className}
          onClick={!hasDistance && !location.hasLocation ? handleGetLocation : undefined}
          disabled={location.isLoading || isFetching}
        >
          {location.isLoading || isFetching ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <MapPin className="mr-2 h-4 w-4" />
          )}
          {hasDistance ? (
            <>
              {showDistance && (
                <span className="mr-1">{location.formattedDistance}</span>
              )}
              {showETA && location.formattedETA && (
                <span className="text-stone-500">({location.formattedETA})</span>
              )}
            </>
          ) : (
            "Get Directions"
          )}
          <ChevronDown className="ml-1 h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {/* Current Location Status */}
        {hasDistance && (
          <div className="px-3 py-2 text-sm">
            <p className="font-medium">Distance to Temple</p>
            <p className="text-2xl font-bold text-orange-600">
              {location.formattedDistance}
            </p>
            {location.formattedETA && (
              <p className="text-stone-500">~{location.formattedETA} away</p>
            )}
          </div>
        )}

        {hasDistance && <DropdownMenuSeparator />}

        {/* Navigation Options */}
        <DropdownMenuItem onClick={() => location.openGoogleMaps()}>
          <Navigation className="mr-2 h-4 w-4" />
          <span>Google Maps</span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => location.openAppleMaps()}>
          <Navigation className="mr-2 h-4 w-4" />
          <span>Apple Maps</span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => location.openWaze()}>
          <Navigation className="mr-2 h-4 w-4" />
          <span>Waze</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Other Actions */}
        <DropdownMenuItem
          onClick={() => navigator.clipboard.writeText(location.getLocationUrl())}
        >
          <MapPin className="mr-2 h-4 w-4" />
          <span>Copy Location Link</span>
        </DropdownMenuItem>

        {!hasDistance && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleGetLocation}>
              <MapPin className="mr-2 h-4 w-4" />
              <span>Get My Location</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Simple Location Button - Just opens navigation
 */
interface SimpleLocationButtonProps {
  variant?: "primary" | "outline" | "ghost";
  size?: "default" | "sm" | "icon" | "icon-sm";
  className?: string;
}

export function SimpleLocationButton({
  variant = "outline",
  size = "icon",
  className = "",
}: SimpleLocationButtonProps) {
  const location = useLocation();

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={() => location.openNavigation()}
      title="Get Directions"
    >
      <Navigation className="h-4 w-4" />
    </Button>
  );
}
