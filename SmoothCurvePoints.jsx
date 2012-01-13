/*
  SmoothCurvePoints.jsx
  A Javascript for Adobe Illustrator

  Author:
  Jim Heck
  jsurf@heckheck.com

  Purpose:
  Smooth curves by converting selected anchor points to corner points and then
  back to smooth points.  This has a normalizing effect in Illustrator that
  causes the curve to proportionally smooth out.

  This is the same general approach as used by Adobe in CS3 and beyond for
  the "convert to smooth" anchor point tool, with boundary conditions and
  slight symmetry issues fixed.

  To Use:
  Select the points along one or more paths, including compound paths to be
  affected.  Run the script.

  Rights:
  This work is licensed under the Creative Commons Attribution 3.0 United States
  License. To view a copy of this license, visit
  http://creativecommons.org/licenses/by/3.0/us/
  or send a letter to Creative Commons, 171 Second Street, Suite 300,
  San Francisco, California, 94105, USA.

  Version History:

  1.0   091003 Initial release.
*/


/*******************************************************************************
 * Function: getPairTheta
 * Description:
 *   Return the angle relative to the X axis from the line formed between
 *   two points, which are passed in as arguments.  The angle is measured
 *   relative to point A (as if A were relocated to the origin, and the angle
 *   is measured to the X axis itself).  The arguments are expected to be
 *   arrays of two numbers (X, Y) defining the point.  The return value is in
 *   radians (PI to -PI)
 */
function getPairTheta(pairA,pairB){
        var deltaX=pairB[0]-pairA[0];
        var deltaY=pairB[1]-pairA[1];
        /*alert("deltaX="+deltaX+" deltaY="+deltaY);*/
        return(Math.atan2(deltaY, deltaX));
}

/*******************************************************************************
 * Function: getPairDistance
 * Description:
 *   Return the distance between two points.  The arguments are expected to be
 *   arrays of two numbers (X, Y) defining the point.  The return value is the
 *   distance in units relative to the inputs.
 */
function getPairDistance(pairA,pairB){
        var deltaX=pairB[0]-pairA[0];
        var deltaY=pairB[1]-pairA[1];
        return(Math.sqrt((deltaX*deltaX)+(deltaY*deltaY)));
}

/*******************************************************************************
 * Function: smoothPoint
 * Description:
 *   Given a point, smooth it by changing the anchor type to smooth and
 *   adjusting the left and right direction handles such that they
 *   form a straight line that is tangential to the curve at the given point
 *   and so that each extends a portion of the distance between this
 *   anchor point and the adjacent anchor point in the respective direction.
 *
 *   This is the same general approach as used by Adobe in CS3 and beyond for
 *   the "convert to smooth" anchor point tool, with boundary conditions and
 *   slight symmetry issues fixed.
 */
function smoothPoint(triplet){
        var prevPoint = triplet[0];
        var currPoint = triplet[1];
        var nextPoint = triplet[2];
        var theta;
        var thetaPrev;
        var thetaNext;
        var pairDistance;
        var deltaX;
        var deltaY;
        var scaleDistanceForHandle = 0.25;

        currPoint.pointType = PointType.SMOOTH;

        /*
         * Calculate the new angle for the left direction handle.
         */
        if (prevPoint == null && nextPoint == null) {
                /*
                 * If neither neighbor is present just return.
                 */
                return;
        }
        else if (prevPoint == null) {
                /*
                 * If the previous point is missing, the leftDirection
                 * handle will be retracted and the rightDirection handle
                 * will point directly to the next point. Theta will be the
                 * angle to the next point, but we must add PI to it here,
                 * since we add PI to the theta below before calculating
                 * the rightDirection handle.
                 */
                prevPoint = currPoint;
                theta = getPairTheta(currPoint.anchor, nextPoint.anchor);
                theta += Math.PI;
        }
        else if (nextPoint == null) {
                /*
                 * If the next point is missing, the rightDirection
                 * handle will be retracted and the leftDirection handle
                 * will point directly to the previous point. Theta will be
                 * the angle to the previous point.
                 */
                nextPoint = currPoint;
                theta = getPairTheta(currPoint.anchor, prevPoint.anchor);
        }
        else {
                /*
                 * If both neighbors are present, theta will be the average
                 * of the angles from the current point to each of the previous
                 * and next points, minus PI/2.  The leftDirection handle should
                 * point in the direction of the previous point, so adjust theta
                 * by adding PI if the absolute difference between theta and
                 * the angle to the previous point is greater than PI/2.
                 */
                thetaPrev = getPairTheta(currPoint.anchor, prevPoint.anchor);
                thetaNext = getPairTheta(currPoint.anchor, nextPoint.anchor);
                var addpi = 0;

                theta = (thetaPrev + thetaNext) / 2 - (Math.PI / 2);
                if (Math.abs(theta - thetaPrev) > (Math.PI / 2)) {
                        theta += Math.PI;
                        addpi = 1;
                }
                /*alert("thetaPrev="+thetaPrev+" thetaNext="+thetaNext+" theta="+theta+" addpi"+addpi);*/
        }

        /*
         * Zero out the direction handles by setting them equal to the current
         * anchor point.
         */
        currPoint.leftDirection = Array( currPoint.anchor[0], currPoint.anchor[1]);
        currPoint.rightDirection = Array( currPoint.anchor[0], currPoint.anchor[1]);

        /*
         * Calculate new smooth point leftDirection handle.  This will be at the
         * angle previously calculated and extend a scaled portion of the
         * distance between the current point and the previous point.
         */
        pairDistance = getPairDistance(prevPoint.anchor, currPoint.anchor);
        deltaX = Math.cos(theta) * scaleDistanceForHandle * pairDistance;
        deltaY = Math.sin(theta) * scaleDistanceForHandle * pairDistance;
        currPoint.leftDirection = Array(currPoint.anchor[0]+deltaX, currPoint.anchor[1]+deltaY);

        /*
         * Now adjust theta by adding PI and calculate the rightDirection handle.
         */
        theta += Math.PI;
        pairDistance = getPairDistance(nextPoint.anchor, currPoint.anchor);
        deltaX = Math.cos(theta) * scaleDistanceForHandle * pairDistance;
        deltaY = Math.sin(theta) * scaleDistanceForHandle * pairDistance;
        currPoint.rightDirection = Array(currPoint.anchor[0]+deltaX, currPoint.anchor[1]+deltaY);
}


/*******************************************************************************
 * Function: getPointTripletByIndex
 * Description:
 *   Given a path, and a point index, return an array of three points consisting
 *   of the previous point, the point at the index and the next point.  If the
 *   path is closed, handle the boundary conditions by returning the properly
 *   wrapped neighbors.  If the path is not closed, return null for points
 *   outside the path limits.
 */
function getPointTripletByIndex(path, index){
        var triplet = new Array();

        if (index >= path.pathPoints.length) {
                return null;
        }

        if (index > 0) {
                triplet.push(path.pathPoints[index-1]);
        }
        else if (index == 0 && path.closed) {
                triplet.push(path.pathPoints[path.pathPoints.length-1]);
        }
        else {
                triplet.push(null);
        }

        triplet.push(path.pathPoints[index]);

        if (path.pathPoints.length > index+1) {
                triplet.push(path.pathPoints[index+1]);
        }
        else if (path.pathPoints.length == index+1 && path.closed) {
                triplet.push(path.pathPoints[0]);
        }
        else {
                triplet.push(null);
        }
        return triplet;
}


/*******************************************************************************
 * Function: docGetSelectedPaths
 * Description:
 *   Get all the selected paths for the docRef argument passed in as
 *   a parameter.  The second parameter is a boolean that controls if compound
 *   path items are included (default true), and the third parameter is a
 *   boolean that controls if locked objects are included (default false).
 *   Returns an array of paths.
 */
function docGetSelectedPaths(docRef, includeCompound, includeLocked){
        var qualifiedPaths = new Array();
        var i = 0;
        var j = 0;
        var nextPath = null;
        var currentSelection = new Array();
        var nextSelection = docRef.selection;

        if (includeCompound == null) {
                includeCompound = true;
        }
        if (includeLocked == null) {
                includeLocked = false;
        }

        do {
                currentSelection = nextSelection;
                nextSelection = [];

                for(i=0; i<currentSelection.length; i++){
                        var currentObject=currentSelection[i];
                        if (currentObject.typename == "PathItem") {
                                if (includeLocked || !(currentObject.locked ||
                                                       currentObject.layer.locked)) {
                                        qualifiedPaths.push(currentObject);
                                }
                        }
                        else if (currentObject.typename == "CompoundPathItem") {
                                if (includeCompound &&
                                    (includeLocked || !(currentObject.locked ||
                                                        currentObject.layer.locked))) {
                                        /*
                                         * For more complex compound paths (e.g. concentric circular bands),
                                         * in CS3 the CompoundPathItem object's pathItems array is empty.
                                         * Inspection of the paths in a document shows the paths contained
                                         * in the CompoundPathItem have groups as parents. To get around
                                         * this seeming bug, in addition to using the pathItems array,
                                         * which still contains individual paths, we also search through
                                         * all the groups in the document adding paths whose parent
                                         * is the CompoundPathItem object.
                                         *
                                         * WARNING this takes non-negligible time in large documents.
                                         */
                                        for (j=0; j<currentObject.pathItems.length; j++) {
                                                qualifiedPaths.push(currentObject.pathItems[j]);
                                        }
                                        for (j=0; j<docRef.groupItems.length; j++) {
                                                if (docRef.groupItems[j].parent == currentObject) {
                                                        nextSelection.push(docRef.groupItems[j]);
                                                }
                                        }
                                }
                        }
                        else if (currentObject.typename == "GroupItem") {
                                for (j=0; j<currentObject.pathItems.length; j++){
                                        nextSelection.push(currentObject.pathItems[j]);
                                }
                                for (j=0; j<currentObject.compoundPathItems.length; j++){
                                        nextSelection.push(currentObject.compoundPathItems[j]);
                                }
                                for (j=0; j<currentObject.groupItems.length; j++){
                                        nextSelection.push(currentObject.groupItems[j]);
                                }
                        }
                        else if (currentObject.typename == "Layer") {
                                for (j=0; j<currentObject.pathItems.length; j++){
                                        nextSelection.push(currentObject.pathItems[j]);
                                }
                                for (j=0; j<currentObject.compoundPathItems.length; j++){
                                        nextSelection.push(currentObject.compoundPathItems[j]);
                                }
                                for (j=0; j<currentObject.groupItems.length; j++){
                                        nextSelection.push(currentObject.groupItems[j]);
                                }
                                for (j=0; j<currentObject.layers.length; j++){
                                        nextSelection.push(currentObject.layers[j]);
                                }
                        }
                }
        } while (nextSelection.length > 0);
        return qualifiedPaths;
}

/*******************************************************************************
/*******************************************************************************
/*******************************************************************************
* Main code
*/
var exitError = 0;

var docRef=app.activeDocument;
var allSelectedPaths = new Array();
var i = 0;
var j = 0;
var triplet;

try {
        if (exitError != 0) {
                throw("exit");
        }

        exitError = 99;

        allSelectedPaths = docGetSelectedPaths(docRef, true, false);
        if (allSelectedPaths.length == 0) {
                exitError = 2;
                throw("exit");
        }

        for (i=0; i<allSelectedPaths.length; i++) {
                for (j=0; j<allSelectedPaths[i].pathPoints.length; j++) {
                        if (allSelectedPaths[i].pathPoints[j].selected == PathPointSelection.ANCHORPOINT) {
                                triplet = getPointTripletByIndex(allSelectedPaths[i], j);
                                smoothPoint(triplet);
                        }
                }
        }
}
catch(er)
{
        if (exitError == 2) {
                alert("No paths selected.");
        }
        if (exitError == 99) {
                alert("ACK! Unexplained error\n");
        }
}
