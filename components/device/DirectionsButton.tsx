"use client";

/**
 * DirectionsButton Component
 * Compact button for getting directions to temple
 */

import { useState } from "react";
import { useLocation } from "@/lib/device/hooks";
import { Navigation, MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DirectionsButtonProps {
  variant?: "primary" | "outline" | "ghost";
  size?: "default" | "sm" | "icon" | "icon-sm";
  className?: string;
  showDistance?: boolean;
  modal?: boolean;
}

export function DirectionsButton({
  variant = "primary",
  size = "default",
  className = "",
  showDistance = true,
  modal = false,
}: DirectionsButtonProps) {
  const location = useLocation();
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (modal) {
      setShowModal(true);
      if (!location.distanceToTemple) {
        setIsLoading(true);
        await location.getCurrentLocation();
        setIsLoading(false);
      }
    } else {
      if (location.distanceToTemple) {
        location.openNavigation();
      } else {
        setShowModal(true);
        setIsLoading(true);
        await location.getCurrentLocation();
        setIsLoading(false);
      }
    }
  };

  const buttonContent = (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Navigation className="mr-2 h-4 w-4" />
      )}
      {size !== "icon" && size !== "icon-sm" && (
        <>
          {showDistance && location.formattedDistance
            ? location.formattedDistance
            : "Get Directions"}
        </>
      )}
    </Button>
  );

  if (!modal) {
    return buttonContent;
  }

  return (
    <>
      {buttonContent}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-orange-600" />
              Directions to Temple
            </DialogTitle>
            <DialogDescription>
              Get directions to Sri Raghavendra Swamy Matha
            </DialogDescription>
          </DialogHeader>

          {/* Distance Display */}
          {location.formattedDistance && (
            <div className="text-center py-4">
              <p className="text-sm text-stone-500 mb-1">Your distance</p>
              <p className="text-4xl font-bold text-orange-600">
                {location.formattedDistance}
              </p>
              {location.formattedETA && (
                <p className="text-stone-500 mt-1">
                  Approximately {location.formattedETA} away
                </p>
              )}
            </div>
          )}

          {/* Temple Address */}
          <div className="bg-stone-50 rounded-lg p-4 mb-4">
            <p className="font-medium text-stone-800">
              {location.templeLocation.name}
            </p>
            <p className="text-sm text-stone-600">
              {location.templeLocation.address}
            </p>
          </div>

          {/* Navigation Options */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => {
                location.openNavigation("google");
                setShowModal(false);
              }}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:bg-stone-50 transition-colors"
            >
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <svg className="h-6 w-6 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
              </div>
              <span className="text-sm font-medium">Google</span>
            </button>

            <button
              onClick={() => {
                location.openNavigation("apple");
                setShowModal(false);
              }}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:bg-stone-50 transition-colors"
            >
              <div className="h-10 w-10 rounded-full bg-stone-200 flex items-center justify-center">
                <Navigation className="h-5 w-5 text-stone-700" />
              </div>
              <span className="text-sm font-medium">Apple</span>
            </button>

            <button
              onClick={() => {
                location.openNavigation("waze");
                setShowModal(false);
              }}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:bg-stone-50 transition-colors"
            >
              <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
                <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.54 6.63c-1.21-1.67-3.29-2.7-5.54-2.7-2.25 0-4.33 1.03-5.54 2.7C7.67 8.1 6 10.78 6 14c0 3.88 2.13 7.33 5.25 9.07.36.2.79.2 1.15 0C14.87 21.33 17 17.88 17 14c0-3.22-1.67-5.9-3.46-7.37zM12 17c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm0-9c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5z"/>
                </svg>
              </div>
              <span className="text-sm font-medium">Waze</span>
            </button>
          </div>

          {/* Copy Link */}
          <button
            onClick={() => {
              navigator.clipboard.writeText(location.getLocationUrl() || "");
              setShowModal(false);
            }}
            className="w-full mt-4 py-2 text-sm text-stone-600 hover:text-stone-800 hover:bg-stone-50 rounded-lg transition-colors"
          >
            Copy Location Link
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Inline Directions Link
 * A text link for getting directions
 */
interface DirectionsLinkProps {
  className?: string;
}

export function DirectionsLink({ className = "" }: DirectionsLinkProps) {
  const location = useLocation();

  return (
    <button
      onClick={() => location.openNavigation()}
      className={`inline-flex items-center gap-1 text-orange-600 hover:text-orange-700 hover:underline ${className}`}
    >
      <Navigation className="h-3 w-3" />
      {location.formattedDistance ? (
        <span>
          {location.formattedDistance} away • Get Directions
        </span>
      ) : (
        <span>Get Directions</span>
      )}
    </button>
  );
}
