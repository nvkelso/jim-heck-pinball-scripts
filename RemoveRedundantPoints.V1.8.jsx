/*
  RemovetRedundantPoints.jsx
  A Javascript for Adobe Illustrator

  Author:
  Jim Heck
  jsurf@heckheck.com

  Purpose:
  Remove anchorpoints on selected path that are coincident in location.
  Finds and optionally removes redundant points from each selected PathItem.
  Useful for cleaning up after Offset Path and Outline Stroke commands in CS3.

  To Use:
  Select the paths, including compound paths to be affected. If no path is
  selected, the script will run for all paths in the document that are not
  locked. Run the script.

  Rights:
  This work is licensed under the Creative Commons Attribution 3.0 United States
  License. To view a copy of this license, visit
  http://creativecommons.org/licenses/by/3.0/us/
  or send a letter to Creative Commons, 171 Second Street, Suite 300,
  San Francisco, California, 94105, USA.

  Version History:
  1.8   120108 More fixes to the logic for keeping only a single point.
  The direction handles for the remaining point are now correctly calculated
  based on relative angle and distance to the original anchor to which a
  handle related.  Also if a SMOOTH point is remaining, the angle of the
  two direction handles has been tweaked to be exactly 180 degrees for
  consistency with the definition of a SMOOTH point.

  1.7   120106 Change the way direction handles and PointType are handled
  when keeping only one point.  Retract handles less than 0.5 points to keep
  consistent angles for SMOOTH point types.  If keepLeadingPoint or
  keepTrailingPoint is specified, try to keep the PointType of that point.
  In the absence of other indicators, base PointType on the point (leading
  or trailing) that has an extended handle.

  1.6.1 090914 Tweak defaults to make sense for my work style

  1.6   090411 Fix a bug in creating a temporary path.  Fix a bug in
  findRedundantPoints(), when searching backwards, the tolerance was always
  applied against the first point on the path instead of the adjacent point
  along the path.  Change selection options so that there is more control over
  which points are processed on a given path.  The new options allow for ignoring
  selection of points, restricting processing to only selected points, or
  processing redundant points if at least one of them is selected. Correct count
  of redundant points removed when both leading and trailing points retained.

  1.5   090404 Change default action to remove. Fix a major performance issue
  in the docGetSelectedPaths() routine.  Searching through all the paths in very
  complex files takes a LONG time.  Instead, search the document groups array.
  BETA: Lots of hacking on the removeRedundantPoints() routine to improve the
  look of the resulting curve when applied to the oxbow problem.

  1.4.1 090331 Fix a bug in removeRedundantPoints(), needed to compare absolute
  error to a tolerance.  Also, loosen up the error criteria so less smooth
  points are mischaracterized as corners.  Tolerance is now 0.02 radians,
  which is about 1.15 degrees.  For some reason, the redundant points on
  arbitrary (non-geometric) outlined paths have lots of slop in the
  direction handles.

  1.4   090331 Add options to control which points are left on removal, leading,
  trailing or both.  If neither is retained, the redundant point positions
  are averaged.  If both are retained, intermediate points are removed, and
  inward facing control handles are synthesized (see comments below).
  Switched to using the atan2 function instead of atan for calculating theta.
  Fixed bugs in docGetSelectedPaths().  CompoundPathItem objects don't seem
  to have properly formed pathItems arrays when they contain what appear to
  be groups of paths.  Also, layer objects can contain layers.

  1.3.1 090327 Limit user entered tolerance value to something sane.

  1.3   090327 Add user controls to specify a tolerance in points for identifying
  redundant points.

  1.2.3 090327 Improve results dialog verbiage.

  1.2.2 090326 Bug fix.  Observe proper unlocking and locking order for
  handling of locked objects.

  1.2.1 090326 Minor bug fixes including, restricting selection only option
  to not be allowed with selection function.

  1.2   090326 Add option to remove only redundant points sets with at least one
  selected point.  Fix broken option to remove locked redundant points.
  Add results dialog OK button.

  1.1   090325 Improve select action to work across selection or entire document.
  Handle nested layers in docGetSelectedPaths().  Clean whitespace.

  1.0.1 090325 Minor bug fix.

  1.0   090311 Initial release.
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
 * Function: findRedundantPoints
 * Description:
 *   Find all sets of redundant points for the input path.  A redundant point
 *   is defined as one that has the same anchor location as a neighboring point.
 *   The arguments are a path to work on, the tolerance in points to apply to
 *   determine a point is redundant, and a boolean to indicate that only
 *   groups of redundant points where at least one point is selected should
 *   be considered.  The return value is an Array of Arrays containing the
 *   indicies of the redundant pathPoint objects found in the path.
 */
function findRedundantPoints(path, tolerance, anySelected, allSelected){
        var anchorDistance = 0;
        var redundantPointSets = new Array();
        var redundantPoint = new Array();
        var selectedRedundantPointSets = new Array();
        var selectedRedundantPoint = new Array();
        var i = 0;
        var j = 0;
        var k = 0;
        var index;
        var selected = false;

        if(path.pathPoints.length > 1) {
                /*
                 * The first path point may be coincident with some at the end of the path
                 * so we check going backwards first.  Redundant points pushed on the
                 * front of the array so they stay in order leftmost to rightmost.
                 */
                redundantPoint.push(0);
                index = 0;
                for (i=path.pathPoints.length-1; i>0; i--) {
                        /*
                         * Get distance and round to nearest hundredth of a point.
                         * If points are closer than the tolerance, consider them
                         * coincident.
                         */
                        anchorDistance = getPairDistance(path.pathPoints[index].anchor, path.pathPoints[i].anchor);
                        anchorDistance = roundToPrecision(anchorDistance, 0.01);
                        if (anchorDistance < tolerance) {
                                redundantPoint.unshift(i);
                        }
                        else {
                                break;
                        }
                        index = i;
                }
                /*
                 * If we haven't used up all the points, start searching forwards
                 * up to the point we stopped searching backwards.  Test the
                 * current point against the next point.  If the next point matches push
                 * its index onto the redundantPoint array.  When the first one doesn't match,
                 * check if the redundantPoint array has more than one index.  If so add it
                 * to the redundantPointSets array. Then clean the redundantPoint array
                 * and push on the next point index.
                 */
                if(i > 0) {
                        for (j=0; j<i; j++) {
                                anchorDistance = getPairDistance(path.pathPoints[j].anchor, path.pathPoints[j+1].anchor);
                                anchorDistance = roundToPrecision(anchorDistance, 0.01);
                                if (anchorDistance < tolerance) {
                                        redundantPoint.push(j+1);
                                }
                                else {
                                        if (redundantPoint.length > 1) {
                                                redundantPointSets.push(redundantPoint);
                                        }
                                        redundantPoint = [];
                                        redundantPoint.push(j+1);
                                }
                        }
                }
                /*
                 * Push the last redundantPoint array onto the redundantPointSets array if
                 * its length is greater than one.
                 */
                if (redundantPoint.length > 1) {
                        redundantPointSets.push(redundantPoint);
                }
        }

        if (anySelected) {
                for (i=0; i<redundantPointSets.length; i++) {
                        var currentPointSet = redundantPointSets[i];
                        selected = false;
                        for (j=0; j<currentPointSet.length; j++) {
                                if (path.pathPoints[currentPointSet[j]].selected ==
                                    PathPointSelection.ANCHORPOINT) {
                                        selected = true;
                                }
                        }
                        if (selected) {
                                selectedRedundantPointSets.push(currentPointSet);
                        }
                }
        }
        else if (allSelected) {
                for (i=0; i<redundantPointSets.length; i++) {
                        var currentPointSet = redundantPointSets[i];
                        for (j=currentPointSet.length-1; j>=0; j--) {
                                var currentPoint = path.pathPoints[currentPointSet[j]];
                                if (currentPoint.selected == PathPointSelection.ANCHORPOINT) {
                                        selectedRedundantPoint.unshift(currentPointSet[j]);
                                }
                                else {
                                        break;
                                }
                        }
                        if (j > 0) {
                                for (k=0; k<j; k++) {
                                        var currentPoint = path.pathPoints[currentPointSet[k]];
                                        if (currentPoint.selected == PathPointSelection.ANCHORPOINT) {
                                                selectedRedundantPoint.push(currentPointSet[k]);
                                        }
                                        else {
                                                if (selectedRedundantPoint.length > 1) {
                                                        selectedRedundantPointSets.push(selectedRedundantPoint);
                                                }
                                                selectedRedundantPoint = [];
                                        }
                                }
                        }
                        if (selectedRedundantPoint.length > 1) {
                                selectedRedundantPointSets.push(selectedRedundantPoint);
                        }
                        selectedRedundantPoint = [];
                }
        }
        else {
                selectedRedundantPointSets = redundantPointSets;
        }

        return(selectedRedundantPointSets);
}

/*******************************************************************************
 * Function: countRedundantPoints
 * Description:
 *   Count the number of redundant points given a redundantPointSets array as
 *   the first parameter.
 */
function countRedundantPoints(redundantPointSets, doKeepLeadingPoint, doKeepTrailingPoint) {
        var i = 0;
        var redundantPoints = 0;
        var pointsKept = 1;

        if (doKeepLeadingPoint && doKeepTrailingPoint) {
                pointsKept = 2;
        }

        for (i=0; i<redundantPointSets.length; i++) {
                redundantPoints += redundantPointSets[i].length - pointsKept;
        }
        return (redundantPoints);
}

/*******************************************************************************
 * Function: countSelectedPoints
 * Description:
 *   Count the number of selected anchor points given a path as the first parameter.
 */
function countSelectedPoints(path) {
        var i = 0;
        var selectedPoints = 0;

        for (i=0; i<path.pathPoints.length; i++) {
                if (path.pathPoints[i].selected == PathPointSelection.ANCHORPOINT) {
                        selectedPoints++;
                }
        }
        return (selectedPoints);
}

/*******************************************************************************
 * Function: removeRedundantPoints
 * Description:
 *   Remove redundant points from a path input as the first parameter.  The
 *   second input parameter should be an array of arrays containing the
 *   indicies of redundant points, as returned from function
 *   findRedundantPoints().  From each set of indicies, the first point is
 *   retained, and the subsequent points are removed from the path.  Care is
 *   taken to preserve the proper leftDirection and rightDirection handles,
 *   as well as the proper PointType for the remaining point. Returns
 *   the number of points removed.
 */
function removeRedundantPoints(path, redundantPointSets, keepLeadingPoint, keepTrailingPoint, keepAveragedPoint){
        var i = 0;
        var j = 0;
        var pointsToRemove = new Array();
        var tempLayer;
        var tempPath;

        /*
         * For each array of redundant point indicies in array redundantPointSets,
         * modify the leadingPoint to have all the properties needed to properly
         * describe the set of coincident points.
         */
        for (i=0; i<redundantPointSets.length; i++) {
                var x = 0;
                var y = 0;
                var currentPointSet = redundantPointSets[i];
                var leadingPoint = path.pathPoints[currentPointSet[0]];
                var trailingPoint = path.pathPoints[currentPointSet[currentPointSet.length-1]];

                if (keepLeadingPoint && keepTrailingPoint) {
                        /*
                         * JAH 090401 REVISIT COMMENT WHEN DONE
                         * If we are keeping two points, the leftDirection of the leading point
                         * and rightDirection of the trailing point are already fixed.  We have to
                         * synthesize the inward facing handles, and choose pointType of the two points.
                         * To allow easy manipultion of the inner handles without disturbing the fixed
                         * handles, make the points PointType.CORNER.  For the direction handles, make
                         * them parallel to their respective paired handle, and extend them half the
                         * distance between the two remaining points.
                         */
                        var averagedPoint;
                        var theta;
                        var deltaX;
                        var deltaY;
                        var pairDistance;
                        var leftDistance;
                        var rightDistance;
                        var firstRemovedIndex = 1;

                        if (currentPointSet.length > 2) {
                                averagedPoint = path.pathPoints[currentPointSet[1]];
                        }
                        else {
                                tempLayer = app.activeDocument.layers.add();
                                tempLayer.name = "Temp";
                                tempPath = tempLayer.pathItems.add();
                                averagedPoint = tempPath.pathPoints.add();
                        }

                        if( currentPointSet.length <= 2 || !keepAveragedPoint ) {
                                /*
                                 * Use just the leading and trailing points.  Create inward facing
                                 * direction handles for the two endpoints based on the relationship
                                 * of the angles between each endpoint and the average point.
                                 *
                                 * For each endpoint, calcualte the angle of the endpoint to the
                                 * average point, and the endpoint to the other endpoint.  Combine
                                 * the angles.  The base angle for the inward facing direction handle
                                 * is the angle that points it towards the average point.  Add to this
                                 * angle, a multiple of the difference between the angle just mentioned,
                                 * and the angle to the other endpoint.  Adding this difference angle
                                 * will bias the curve towards the average point.  Finally, set the
                                 * length of the direction handle as the distance from the endpoint
                                 * to the average point multiplied by a factor.
                                 */
                                var thetaAverage;
                                var thetaPair;
                                var tweakThetaToOppositeEndpoint = 1.0;
                                var tweakPairDistance = 0.5;

                                /*
                                 * Since the leading and trailing points will have direction handles pointing
                                 * in different directions, these points must be corner points by necessity.
                                 */
                                leadingPoint.pointType = PointType.CORNER;
                                trailingPoint.pointType = PointType.CORNER;

                                /*
                                 * Create new average point.
                                 */
                                for (j=0; j<currentPointSet.length; j++) {
                                        x += path.pathPoints[currentPointSet[j]].anchor[0];
                                        y += path.pathPoints[currentPointSet[j]].anchor[1];
                                }
                                x /= currentPointSet.length;
                                y /= currentPointSet.length;
                                averagedPoint.anchor = Array(x, y);
                                averagedPoint.leftDirection = Array( averagedPoint.anchor[0], averagedPoint.anchor[1]);
                                averagedPoint.rightDirection = Array( averagedPoint.anchor[0], averagedPoint.anchor[1]);
                                averagedPoint.pointType = PointType.CORNER;

                                /* Calcualte new leading point rightDirection */
                                pairDistance = getPairDistance(leadingPoint.anchor, averagedPoint.anchor);

                                thetaAverage = getPairTheta(leadingPoint.anchor, averagedPoint.anchor);
                                thetaPair = getPairTheta(leadingPoint.anchor, trailingPoint.anchor);
                                theta = thetaAverage + tweakThetaToOppositeEndpoint * (thetaAverage - thetaPair);
                                /*alert("thetaAverage="+thetaAverage+" thetaPair="+thetaPair" theta="+theta);*/
                                deltaX = Math.cos(theta) * tweakPairDistance * pairDistance;
                                deltaY = Math.sin(theta) * tweakPairDistance * pairDistance;

                                leadingPoint.rightDirection = Array(leadingPoint.anchor[0]+deltaX, leadingPoint.anchor[1]+deltaY);

                                /* Calcualte new trailing point leftDirection */
                                pairDistance = getPairDistance(trailingPoint.anchor, averagedPoint.anchor);

                                thetaAverage = getPairTheta(trailingPoint.anchor, averagedPoint.anchor);
                                thetaPair = getPairTheta(trailingPoint.anchor, leadingPoint.anchor);
                                theta = thetaAverage + tweakThetaToOppositeEndpoint * (thetaAverage - thetaPair);
                                /*alert("thetaAverage="+thetaAverage+" thetaPair="+thetaPair" theta="+theta);*/
                                deltaX = Math.cos(theta) * tweakPairDistance * pairDistance;
                                deltaY = Math.sin(theta) * tweakPairDistance * pairDistance;

                                trailingPoint.leftDirection = Array(trailingPoint.anchor[0]+deltaX, trailingPoint.anchor[1]+deltaY);
                        }
                        else {
                                /*
                                 * Use just the leading and trailing points, along with a third point added
                                 * at the average of all the removed points.  This point will act to anchor
                                 * the curve at the average point.  It will also allow the leading and
                                 * trailing points to be smooth points, allowing for a continuous
                                 * curve through them.
                                 *
                                 * The inward facing direction handles for the two endpoints will be
                                 * shortened extensions of the outward facing direction handles for these
                                 * points.  The length of the handles will be a multiple of the
                                 * distance from the direction handle to the average point.
                                 *
                                 * For the average point, the direction handles will be parallel to the
                                 * angle formed by the angle between the two endpoints.  The length
                                 * of the direction handles for this point will be a different multiple
                                 * of the length from each endpoint to the average point.
                                 */
                                var thetaAverage;
                                var thetaPair;
                                var tweakPairDistanceForAveraged = 0.5;
                                var tweakPairDistanceForEndpoint = 0.25;

                                /*
                                 * Since the leading and trailing points will have direction handles that
                                 * are parallel, make them smooth points.
                                 */
                                leadingPoint.pointType = PointType.SMOOTH;
                                trailingPoint.pointType = PointType.SMOOTH;

                                /* We will be keeping one more point, the averaged point. */
                                firstRemovedIndex = 2;

                                /*
                                 * Create new average point.
                                 */
                                for (j=0; j<currentPointSet.length; j++) {
                                        x += path.pathPoints[currentPointSet[j]].anchor[0];
                                        y += path.pathPoints[currentPointSet[j]].anchor[1];
                                }
                                x /= currentPointSet.length;
                                y /= currentPointSet.length;
                                averagedPoint.anchor = Array(x, y);
                                averagedPoint.leftDirection = Array( averagedPoint.anchor[0], averagedPoint.anchor[1]);
                                averagedPoint.rightDirection = Array( averagedPoint.anchor[0], averagedPoint.anchor[1]);
                                averagedPoint.pointType = PointType.SMOOTH;

                                /* Calcualte new averaged point leftDirection */
                                pairDistance = getPairDistance(leadingPoint.anchor, averagedPoint.anchor);

                                theta = getPairTheta(leadingPoint.anchor, trailingPoint.anchor);
                                /*alert("theta="+theta);*/
                                if (theta > 0) {
                                        theta += Math.PI;
                                }
                                else {
                                        theta += -Math.PI;
                                }
                                deltaX = Math.cos(theta) * tweakPairDistanceForAveraged * pairDistance;
                                deltaY = Math.sin(theta) * tweakPairDistanceForAveraged * pairDistance;

                                averagedPoint.leftDirection = Array(averagedPoint.anchor[0]+deltaX, averagedPoint.anchor[1]+deltaY);

                                /* Calcualte new averaged point rightDirection */
                                pairDistance = getPairDistance(trailingPoint.anchor, averagedPoint.anchor);

                                theta = getPairTheta(trailingPoint.anchor, averagedPoint.anchor);
                                /*alert("theta="+theta);*/
                                if (theta > 0) {
                                        theta += Math.PI;
                                }
                                else {
                                        theta += -Math.PI;
                                }
                                deltaX = Math.cos(theta) * tweakPairDistanceForAveraged * pairDistance;
                                deltaY = Math.sin(theta) * tweakPairDistanceForAveraged * pairDistance;

                                averagedPoint.rightDirection = Array(averagedPoint.anchor[0]+deltaX, averagedPoint.anchor[1]+deltaY);

                                /* Calculate direction handles for leading and trailing points */
                                pairDistance = getPairDistance(leadingPoint.anchor, trailingPoint.anchor);

                                leftDistance = getPairDistance(leadingPoint.anchor, leadingPoint.leftDirection);
                                if (leftDistance > 0) {
                                        theta = getPairTheta(leadingPoint.anchor, leadingPoint.leftDirection);
                                        /*alert("theta="+theta);*/
                                        if (theta > 0) {
                                                theta += Math.PI;
                                        }
                                        else {
                                                theta += -Math.PI;
                                        }
                                        pairDistance = getPairDistance(leadingPoint.anchor, averagedPoint.anchor);
                                        deltaX = Math.cos(theta) * tweakPairDistanceForEndpoint * pairDistance;
                                        deltaY = Math.sin(theta) * tweakPairDistanceForEndpoint * pairDistance;
                                        leadingPoint.rightDirection = Array(leadingPoint.anchor[0]+deltaX, leadingPoint.anchor[1]+deltaY);
                                }
                                else {
                                        leadingPoint.rightDirection = leadingPoint.anchor;
                                }

                                rightDistance = getPairDistance(trailingPoint.anchor, trailingPoint.rightDirection);
                                if (rightDistance > 0) {
                                        theta = getPairTheta(trailingPoint.anchor, trailingPoint.rightDirection);
                                        if (theta > 0) {
                                                theta += Math.PI;
                                        }
                                        else {
                                                theta += -Math.PI;
                                        }
                                        pairDistance = getPairDistance(trailingPoint.anchor, averagedPoint.anchor);
                                        deltaX = Math.cos(theta) * tweakPairDistanceForEndpoint * pairDistance;
                                        deltaY = Math.sin(theta) * tweakPairDistanceForEndpoint * pairDistance;
                                        trailingPoint.leftDirection = Array(trailingPoint.anchor[0]+deltaX, trailingPoint.anchor[1]+deltaY);
                                }
                                else {
                                        trailingPoint.leftDirection = trailingPoint.anchor;
                                }
                        }

                        /*
                         * Push all points other than the leading and trailing onto the pointsToRemove array
                         * for later removal.  We can't remove them while we are working with later sets.
                         */
                        for (j=firstRemovedIndex; j<currentPointSet.length-1; j++) {
                                pointsToRemove.push(currentPointSet[j]);
                        }
                }
                else {
                        /*
                         * If we are only keeping one point, we will work with the leading point.
                         * First, calculate the relative distances and angles of the direction handle for
                         * the leadingPoint leftDirection handle and the trailingPoint rightDirection
                         * handle.  These values will be used to help properly construct the remaining
                         * point.
                         */
                        var leftDistance = getPairDistance(leadingPoint.anchor, leadingPoint.leftDirection);
                        var rightDistance = getPairDistance(trailingPoint.anchor, trailingPoint.rightDirection);
                        var leftTheta = getPairTheta(leadingPoint.anchor, leadingPoint.leftDirection);
                        var rightTheta = getPairTheta(trailingPoint.anchor, trailingPoint.rightDirection);

                        /*
                         * If we are keeping the leadingPoint, calculate a relative rightDirection handle
                         * based on the trailingPoint rightDistance and rightTheta.  If we are keeping the
                         * trailingPoint, copy its anchor and rightDirection handle to the leadingPoint,
                         * and calculate a relative leftDirection handle based on the leadingPoint
                         * leftDistance and leftTheta.  If we are to keep neither leading or trailing point,
                         * average the position of all the redundant points and calcuate direction handles
                         * based on the appropriate values.
                         */
                        if (keepLeadingPoint) {
                                x = leadingPoint.anchor[0] + (Math.cos(rightTheta) * rightDistance);
                                y = leadingPoint.anchor[1] + (Math.sin(rightTheta) * rightDistance);
                                leadingPoint.rightDirection = Array(x, y);
                        }
                        else if (keepTrailingPoint) {
                                leadingPoint.anchor = trailingPoint.anchor;
                                leadingPoint.rightDirection = trailingPoint.rightDirection;
                                x = leadingPoint.anchor[0] + (Math.cos(leftTheta) * leftDistance);
                                y = leadingPoint.anchor[1] + (Math.sin(leftTheta) * leftDistance);
                                leadingPoint.leftDirection = Array(x, y);
                        }
                        else {
                                for (j=0; j<currentPointSet.length; j++) {
                                        x += path.pathPoints[currentPointSet[j]].anchor[0];
                                        y += path.pathPoints[currentPointSet[j]].anchor[1];
                                }
                                x /= currentPointSet.length;
                                y /= currentPointSet.length;
                                leadingPoint.anchor = Array(x, y);
                                x = leadingPoint.anchor[0] + (Math.cos(leftTheta) * leftDistance);
                                y = leadingPoint.anchor[1] + (Math.sin(leftTheta) * leftDistance);
                                leadingPoint.leftDirection = Array(x, y);
                                x = leadingPoint.anchor[0] + (Math.cos(rightTheta) * rightDistance);
                                y = leadingPoint.anchor[1] + (Math.sin(rightTheta) * rightDistance);
                                leadingPoint.rightDirection = Array(x, y);
                        }

                        /*
                         * If the distance for a handle is less than half a point and rounds to zero,
                         * retract that handle fully by setting that direction handle equal to the anchor
                         * point.  This will keep angles consistent for smooth points.
                         */
                        if (Math.round(leftDistance) == 0) {
                                leadingPoint.leftDirection = leadingPoint.anchor;
                        }
                        if (Math.round(rightDistance) == 0) {
                                leadingPoint.rightDirection = leadingPoint.anchor;
                        }

                        /*
                         * Handle the PointType in a minimal manner.  If keeping the leadingPoint or keeping
                         * the trailingPoint, keep the PointType of that point if possible.  If both handles
                         * are extended, measure the angles of the two direction handles.  If both handles
                         * have the same angle relative to the X axis within a tolerance, the PointType
                         * can be SMOOTH, otherwise it must be CORNER.  If the point type is SMOOTH, ensure
                         * the direction handles are corrected to be exactly 180 degrees apart.
                         *
                         * If not specifically keeping the leading or trailing point and only one handle is
                         * extended, base the pointType on the the leadingPoint if only the left handle is
                         * extended and the trailingPoint if only the right handle is extended.  
                         */
                        if (Math.round(leftDistance) > 0 && Math.round(rightDistance) > 0) {
                                var absdiff = Math.abs(leftTheta-rightTheta);
                                var error = Math.PI - absdiff;
                                /*alert("leftTheta="+leftTheta+" rightTheta="+rightTheta+" absdiff="+absdiff+" error="+error);*/
                                if (Math.abs(error) < 0.02) {
                                        if (keepTrailingPoint) {
                                                leadingPoint.pointType = trailingPoint.pointType;
                                        }
                                        else if (!keepLeadingPoint) {
                                                leadingPoint.pointType = PointType.SMOOTH;
                                        }
                                        if (leadingPoint.pointType == PointType.SMOOTH) {
                                                if (keepTrailingPoint) {
                                                        x = leadingPoint.anchor[0] + (Math.cos(Math.PI + rightTheta) * leftDistance);
                                                        y = leadingPoint.anchor[1] + (Math.sin(Math.PI + rightTheta) * leftDistance);
                                                        leadingPoint.leftDirection = Array(x, y);
                                                }
                                                else {
                                                        x = leadingPoint.anchor[0] + (Math.cos(Math.PI + leftTheta) * rightDistance);
                                                        y = leadingPoint.anchor[1] + (Math.sin(Math.PI + leftTheta) * rightDistance);
                                                        leadingPoint.rightDirection = Array(x, y);
                                                }
                                        }
                                }
                                else {
                                        leadingPoint.pointType = PointType.CORNER;
                                }
                        }
                        else if (keepTrailingPoint) {
                                leadingPoint.pointType = trailingPoint.pointType;
                        }
                        else if (!keepLeadingPoint && rightDistance > 0) {
                                leadingPoint.pointType = trailingPoint.pointType;
                        }

                        /*
                         * Push all other points onto the pointsToRemove array for later removal.  We can't
                         * remove them while we are working with later sets.
                         */
                        for (j=1; j<currentPointSet.length; j++) {
                                pointsToRemove.push(currentPointSet[j]);
                        }
                }
        }
        /*
         * Sort the pointsToRemove array and then remove the points in reverse order, so the indicies
         * remain coherent during the removal.
         */
        pointsToRemove.sort(function (a,b) { return a-b });
        for (i=pointsToRemove.length-1; i>=0; i--) {
                var pointToRemove = path.pathPoints[pointsToRemove[i]];
                pointToRemove.remove();
        }
        if (tempPath) {
                tempPath.remove();
        }
        if (tempLayer) {
                tempLayer.remove();
        }
        return (pointsToRemove.length);
}


/*******************************************************************************
 * Function: selectRedundantPoints
 * Description:
 *   Select redundant points on a path input as the first parameter.  The
 *   second input parameter should be an array of arrays containing the
 *   indicies of redundant points, as returned from function
 *   findRedundantPoints().  If there are redundant points, deselect all points
 *   on the path and select the ANCHORPOINT of each redundant point.  If there
 *   are no redundant points on the path, do nothing.
 */
function selectRedundantPoints(path, redundantPointSets){
        var i = 0;
        var j = 0;
        if (redundantPointSets.length > 0) {
                for (i=0; i<path.pathPoints.length; i++) {
                        path.pathPoints[i].selected = PathPointSelection.NOSELECTION;
                }
                for (i=0; i<redundantPointSets.length; i++) {
                        var currentPointSet = redundantPointSets[i];
                        for (j=0; j<currentPointSet.length; j++) {
                                path.pathPoints[currentPointSet[j]].selected = PathPointSelection.ANCHORPOINT;
                        }
                }
        }
}


/*******************************************************************************
 * Function: unlockPath
 * Description:
 *   For a path input as the first parameter, unlock the path and any locked
 *   parent object.  Return an array of objects that have been unlocked.
 */
function unlockPath(path){
        var unlockedObjects = new Array();
        var parentObjects = new Array();
        var currentObject = path;
        var i = 0;

        while (currentObject.typename != "Document") {
                parentObjects.unshift(currentObject);
                currentObject = currentObject.parent;
        }
        for (i=0; i<parentObjects.length; i++) {
                if (parentObjects[i].locked) {
                        parentObjects[i].locked = false;
                        unlockedObjects.unshift(parentObjects[i]);
                }
        }
        return unlockedObjects;
}


/*******************************************************************************
 * Function: lockObjects
 * Description:
 *   For a set of objects as the first parameter, lock each object.
 */
function lockObjects(objects){
        var i = 0;
        for (i=0; i<objects.length; i++) {
                objects[i].locked = true;
        }
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
 * Function: docGetAllPaths
 * Description:
 *   Get all the paths for the docRef argument passed in as a parameter.
 *   The second parameter is a boolean that controls if compound path items are
 *   included (default true), and the third parameter is a boolean that controls
 *   if locked objects are included (default false).  Returns an array of paths.
 */
function docGetAllPaths(docRef, includeCompound, includeLocked) {
        var qualifiedPaths = new Array();
        var i = 0;
        var nextPath = null;

        if (includeCompound == null) {
                includeCompound = true;
        }
        if (includeLocked == null) {
                includeLocked = false;
        }

        for (i=0; i<docRef.pathItems.length; i++) {
                nextPath = docRef.pathItems[i];
                if (!includeCompound && nextPath.parent.typename == "CompoundPathItem") {
                        continue;
                }
                if (!includeLocked && (nextPath.layer.locked == true || nextPath.locked == true)) {
                        continue;
                }
                qualifiedPaths.push(nextPath);
        }
        return qualifiedPaths;
}

/*******************************************************************************
 * Function: roundToPrecision
 * Description:
 *   Round a number input as the first parameter to a given precision.  The
 *   second input parameter is the precision to round to (typically a power of
 *   10, like 0.1).  Returns the rounded value.
 */
function roundToPrecision(value, precision) {
        var result;

        result = value / precision;
        result = Math.round(result);
        result = result * precision;

        return (result);
}

/*******************************************************************************
/*******************************************************************************
/*******************************************************************************
* Main code
*/
var dlgInit = new Window('dialog', 'Redundant Path Points');
doInitDialog(dlgInit);

var exitError;
var tolerance = 1 * (dlgInit.tolerancePnl.editText.text);
var doAnalyze = dlgInit.functionPnl.doAnalyze.value;
var doRemove = dlgInit.functionPnl.doRemove.value;
var doSelect = dlgInit.functionPnl.doSelect.value;
var doKeepLeadingPoint = dlgInit.removalPnl.doKeepLeadingPoint.value;
var doKeepTrailingPoint = dlgInit.removalPnl.doKeepTrailingPoint.value;
var doKeepAveragedPoint = dlgInit.removalPnl.doKeepAveragedPoint.value;
var includeCompound = dlgInit.optionPnl.includeCompound.value;
var includeLocked = dlgInit.optionPnl.includeLocked.value;
var ignoreSelected = dlgInit.selectionPnl.ignoreSelected.value;
var anySelected = dlgInit.selectionPnl.anySelected.value;
var allSelected = dlgInit.selectionPnl.allSelected.value;

var docRef=app.activeDocument;
var pathsToProcess = new Array();
var i = 0;
var j = 0;
var totalPaths = 0;
var totalPointsWithRedundancy = 0;
var totalPointsToRemove = 0;
var totalPointsRemoved = 0;
var totalPointsStarting = 0;
var totalPointsRemaining = 0;
var totalPointsSelected = 0;
var redundantPointSets = new Array();
var unlockedObjects = new Array();

try {
        if (exitError != 0) {
                throw("exit");
        }

        exitError = 99;

        if (docRef.selection.length > 0) {
                pathsToProcess = docGetSelectedPaths(docRef, includeCompound, includeLocked);
        }
        else {
                var doAll = confirm("Run script for all paths in document?");
                if (doAll) {
                        pathsToProcess = docGetAllPaths(docRef, includeCompound, includeLocked);
                }
        }

        if (doSelect) {
                if (includeLocked) {
                        exitError = 2;
                        throw("exit");
                }

                if (!ignoreSelected) {
                        exitError = 3;
                        throw("exit");
                }

                docRef.selection = null;
        }

        for (i=0; i<pathsToProcess.length; i++) {
                redundantPointSets = findRedundantPoints(pathsToProcess[i], tolerance, anySelected, allSelected);

                totalPaths++;
                totalPointsWithRedundancy += redundantPointSets.length;
                totalPointsToRemove += countRedundantPoints(redundantPointSets, doKeepLeadingPoint, doKeepTrailingPoint);
                totalPointsStarting += pathsToProcess[i].pathPoints.length;
                totalPointsSelected += countSelectedPoints(pathsToProcess[i]);

                if (doRemove) {
                        if (includeLocked) {
                                unlockedObjects = unlockPath(pathsToProcess[i]);
                        }
                        else {
                                unlockedObjects = [];
                        }

                        totalPointsRemoved += removeRedundantPoints(pathsToProcess[i], redundantPointSets, doKeepLeadingPoint, doKeepTrailingPoint, doKeepAveragedPoint);

                        if (unlockedObjects.length > 0) {
                                lockObjects(unlockedObjects);
                        }
                }

                if (doSelect) {
                        selectRedundantPoints(pathsToProcess[i], redundantPointSets);
                }

                totalPointsRemaining += pathsToProcess[i].pathPoints.length;
        }

        var dlgResults = new Window('dialog', 'Redundant Path Points');
        doResultsDialog(dlgResults,
                        totalPaths,
                        totalPointsWithRedundancy,
                        totalPointsToRemove,
                        totalPointsRemoved,
                        totalPointsStarting,
                        totalPointsRemaining,
                        totalPointsSelected,
                        tolerance);

}
catch(er)
{
        if (exitError == 2) {
                alert("Select function not supported in conjunction with 'Include Locked Items' option.");
        }
        if (exitError == 3) {
                alert("Select function supported only with 'Ignore' selection restriction.");
        }
        if (exitError == 99) {
                alert("ACK! Unexplained error\n");
        }
}

/*******************************************************************************
/*******************************************************************************
* Dialog Code
*/

/*******************************************************************************
 * Function: doInitDialog
 */
function doInitDialog(dlgInit) {
        var defaultTolerance = 5.0;
        var maxSliderTolerance = 5;

        /* Add radio buttons to control functionality */
        dlgInit.functionPnl = dlgInit.add('panel', undefined, 'Function:');
        (dlgInit.functionPnl.doAnalyze = dlgInit.functionPnl.add('radiobutton', undefined, 'Analyze' )).helpTip = "Find and count redundant points.";
        (dlgInit.functionPnl.doRemove = dlgInit.functionPnl.add('radiobutton', undefined, 'Remove' )).helpTip = "Find and remove redundant points.";
        (dlgInit.functionPnl.doSelect = dlgInit.functionPnl.add('radiobutton', undefined, 'Select' )).helpTip = "Find and select redundant points.\nWARNING:Manual removal of selected redundant points can change the shape of your curves.\nTips:Hiding bounding box helps to see which points are selected.  Modify selection as desired and rerun script to remove specific redundant points.";
        dlgInit.functionPnl.doRemove.value = true;
        dlgInit.functionPnl.orientation='row';

        /* Add radio buttons to control point selection */
        dlgInit.selectionPnl = dlgInit.add('panel', undefined, 'Point Selection State:');
        (dlgInit.selectionPnl.ignoreSelected = dlgInit.selectionPnl.add('radiobutton', undefined, 'Ignore')).helpTip="Process redundant points on a path regardless of their selection state.";
        (dlgInit.selectionPnl.allSelected = dlgInit.selectionPnl.add('radiobutton', undefined, 'All')).helpTip="Process redundant points on a path only if each of them is selected.";
        (dlgInit.selectionPnl.anySelected = dlgInit.selectionPnl.add('radiobutton', undefined, 'Any')).helpTip="Process redundant points on a path if any one of them is selected.";
        dlgInit.selectionPnl.allSelected.value = true;
        dlgInit.selectionPnl.orientation='row';

        /* Add a checkbox to control options */
        dlgInit.optionPnl = dlgInit.add('panel', undefined, 'Other Options:');
        (dlgInit.optionPnl.includeCompound = dlgInit.optionPnl.add('checkbox', undefined, 'Include Compound Path Items?')).helpTip="Work on compound path items.";
        (dlgInit.optionPnl.includeLocked = dlgInit.optionPnl.add('checkbox', undefined, 'Include Locked Items?')).helpTip="Work on locked items or items in locked layers.";
        dlgInit.optionPnl.includeCompound.value = true;
        dlgInit.optionPnl.includeLocked.value = false;
        dlgInit.optionPnl.alignChildren='left';
        dlgInit.optionPnl.orientation='column';

        /* Add a slider and edit box for user entered tolerance */
        dlgInit.tolerancePnl = dlgInit.add('panel', undefined, 'Tolerance (in PostScript points):');
        (dlgInit.tolerancePnl.slide = dlgInit.tolerancePnl.add('slider', undefined, defaultTolerance, 0.01, maxSliderTolerance)).helpTip="Use slider to set a tolerance value in hundredths of a point.";
        (dlgInit.tolerancePnl.editText = dlgInit.tolerancePnl.add('edittext', undefined, defaultTolerance)).helpTip="Enter a tolerance value.  Values greater then 5.0 or more precise than 1/100 point can be manually entered here.";
        dlgInit.tolerancePnl.editText.characters = 5;
        dlgInit.tolerancePnl.orientation='row';
        dlgInit.tolerancePnl.slide.onChange = toleranceSliderChanged;
        dlgInit.tolerancePnl.editText.onChange = toleranceEditTextChanged;

        /* Add a panel control removal options */
        dlgInit.removalPnl = dlgInit.add('panel', undefined, 'Removal Options:');
        (dlgInit.removalPnl.doKeepLeadingPoint = dlgInit.removalPnl.add('checkbox', undefined, 'Keep Leading Point' )).helpTip = "Keep the leading point (lowest path index, lowest prior to origin cross for closed path).";
        (dlgInit.removalPnl.doKeepTrailingPoint = dlgInit.removalPnl.add('checkbox', undefined, 'Keep Trailing Point' )).helpTip = "Keep the trailing point (highest path index, highest following origin cross for closed path).";
        (dlgInit.removalPnl.doKeepAveragedPoint = dlgInit.removalPnl.add('checkbox', undefined, 'Keep Averaged Point' )).helpTip = "Keep an averaged point to help smooth transitions.";
        dlgInit.removalPnl.keepTips = dlgInit.removalPnl.add('statictext', undefined, 'Keeping neither will cause position of remaining point to be averaged.  Keeping both will anchor two ends of a segment while removing intermediate redundant points.  An averaged point helps smooth transitions.', {multiline:'true'} );
        dlgInit.removalPnl.doKeepLeadingPoint.value = false;
        dlgInit.removalPnl.doKeepTrailingPoint.value = false;
        dlgInit.removalPnl.doKeepAveragedPoint.value = false;
        dlgInit.removalPnl.alignChildren='left';
        dlgInit.removalPnl.orientation='column';

        /* Add execution buttons */
        dlgInit.executeGrp = dlgInit.add('group', undefined, 'Execute:');
        dlgInit.executeGrp.orientation='row';
        dlgInit.executeGrp.buildBtn1= dlgInit.executeGrp.add('button',undefined, 'Cancel', {name:'cancel'});
        dlgInit.executeGrp.buildBtn2 = dlgInit.executeGrp.add('button', undefined, 'OK', {name:'ok'});
        dlgInit.executeGrp.buildBtn1.onClick= initActionCanceled;
        dlgInit.executeGrp.buildBtn2.onClick= initActionOk;

        dlgInit.frameLocation = [100, 100];
        dlgInit.alignChildren='fill';
        dlgInit.show();

        return dlgInit;
}

function initActionCanceled() {
        exitError = 1;
        dlgInit.hide();
}

function initActionOk() {
        var proceed = true;

        exitError = 0;

        if (dlgInit.tolerancePnl.editText.text > 5.0) {
                proceed = confirm("Tolerance entered greater than 5.0 PostScript points.  Proceed?");
        }
        if (proceed) {
                dlgInit.hide();
        }
}

function toleranceSliderChanged() {
        dlgInit.tolerancePnl.editText.text = roundToPrecision(dlgInit.tolerancePnl.slide.value, 0.01);
}

function toleranceEditTextChanged() {
        if (dlgInit.tolerancePnl.editText.text > 5000) {
                dlgInit.tolerancePnl.editText.text = 5000;
        }
        dlgInit.tolerancePnl.slide.value = roundToPrecision(dlgInit.tolerancePnl.editText.text, 0.01);
}


/*******************************************************************************
 * Function: doResultsDialog
 */
function doResultsDialog(dlgResults,
                         totalPaths,
                         totalPointsWithRedundancy,
                         totalPointsToRemove,
                         totalPointsRemoved,
                         totalPointsStarting,
                         totalPointsRemaining,
                         totalPointsSelected,
                         tolerance) {

        /* Add static text to display results */
        dlgResults.resultsPnl = dlgResults.add('panel', undefined, 'Results:');
        dlgResults.resultsPnl.totalPaths = dlgResults.resultsPnl.add('group');
        dlgResults.resultsPnl.totalPaths.txt = dlgResults.resultsPnl.totalPaths.add('statictext', undefined, 'Paths processed: ');
        dlgResults.resultsPnl.totalPaths.txt.alignment = 'right';
        dlgResults.resultsPnl.totalPaths.val = dlgResults.resultsPnl.totalPaths.add('statictext', undefined, totalPaths);
        dlgResults.resultsPnl.totalPaths.val.characters = 10;
        dlgResults.resultsPnl.totalPaths.val.helpTip = "The number of paths processed.";
        dlgResults.resultsPnl.totalPointsSelected = dlgResults.resultsPnl.add('group');
        dlgResults.resultsPnl.totalPointsSelected.txt = dlgResults.resultsPnl.totalPointsSelected.add('statictext', undefined, 'Total points selected: ');
        dlgResults.resultsPnl.totalPointsSelected.txt.alignment = 'right';
        dlgResults.resultsPnl.totalPointsSelected.val = dlgResults.resultsPnl.totalPointsSelected.add('statictext', undefined, totalPointsSelected);
        dlgResults.resultsPnl.totalPointsSelected.val.characters = 10;
        dlgResults.resultsPnl.totalPointsSelected.val.helpTip = "The total number of points initially selected.";
        dlgResults.resultsPnl.separator0 = dlgResults.resultsPnl.add('panel');
        dlgResults.resultsPnl.totalPointsWithRedundancy = dlgResults.resultsPnl.add('group');
        dlgResults.resultsPnl.totalPointsWithRedundancy.txt = dlgResults.resultsPnl.totalPointsWithRedundancy.add('statictext', undefined, 'Points with redundancy: ');
        dlgResults.resultsPnl.totalPointsWithRedundancy.txt.alignment = 'right';
        dlgResults.resultsPnl.totalPointsWithRedundancy.val = dlgResults.resultsPnl.totalPointsWithRedundancy.add('statictext', undefined, totalPointsWithRedundancy);
        dlgResults.resultsPnl.totalPointsWithRedundancy.val.characters = 10;
        dlgResults.resultsPnl.totalPointsWithRedundancy.val.helpTip = "The number of points with redundancy.";
        dlgResults.resultsPnl.totalPointsToRemove = dlgResults.resultsPnl.add('group');
        dlgResults.resultsPnl.totalPointsToRemove.txt = dlgResults.resultsPnl.totalPointsToRemove.add('statictext', undefined, 'Redundant points to remove: ');
        dlgResults.resultsPnl.totalPointsToRemove.txt.alignment = 'right';
        dlgResults.resultsPnl.totalPointsToRemove.val = dlgResults.resultsPnl.totalPointsToRemove.add('statictext', undefined, totalPointsToRemove);
        dlgResults.resultsPnl.totalPointsToRemove.val.characters = 10;
        dlgResults.resultsPnl.totalPointsToRemove.val.helpTip = "The number of redundant points that would be removed.";
        dlgResults.resultsPnl.totalPointsRemoved = dlgResults.resultsPnl.add('group');
        dlgResults.resultsPnl.totalPointsRemoved.txt = dlgResults.resultsPnl.totalPointsRemoved.add('statictext', undefined, 'Redundant points removed: ');
        dlgResults.resultsPnl.totalPointsRemoved.txt.alignment = 'right';
        dlgResults.resultsPnl.totalPointsRemoved.val = dlgResults.resultsPnl.totalPointsRemoved.add('statictext', undefined, totalPointsRemoved);
        dlgResults.resultsPnl.totalPointsRemoved.val.characters = 10;
        dlgResults.resultsPnl.totalPointsRemoved.val.helpTip = "The number of redundant points that were removed.";
        dlgResults.resultsPnl.separator1 = dlgResults.resultsPnl.add('panel');
        dlgResults.resultsPnl.totalPointsStarting = dlgResults.resultsPnl.add('group');
        dlgResults.resultsPnl.totalPointsStarting.txt = dlgResults.resultsPnl.totalPointsStarting.add('statictext', undefined, 'Total points starting: ');
        dlgResults.resultsPnl.totalPointsStarting.txt.alignment = 'right';
        dlgResults.resultsPnl.totalPointsStarting.val = dlgResults.resultsPnl.totalPointsStarting.add('statictext', undefined, totalPointsStarting);
        dlgResults.resultsPnl.totalPointsStarting.val.characters = 10;
        dlgResults.resultsPnl.totalPointsStarting.helpTip = "The total number of points before processing.";
        dlgResults.resultsPnl.totalPointsRemaining = dlgResults.resultsPnl.add('group');
        dlgResults.resultsPnl.totalPointsRemaining.txt = dlgResults.resultsPnl.totalPointsRemaining.add('statictext', undefined, 'Total points remaining: ');
        dlgResults.resultsPnl.totalPointsRemaining.txt.alignment = 'right';
        dlgResults.resultsPnl.totalPointsRemaining.val = dlgResults.resultsPnl.totalPointsRemaining.add('statictext', undefined, totalPointsRemaining);
        dlgResults.resultsPnl.totalPointsRemaining.val.characters = 10;
        dlgResults.resultsPnl.totalPointsRemaining.val.helpTip = "The total number of points after processing.";
        dlgResults.resultsPnl.alignChildren='right';
        dlgResults.resultsPnl.orientation='column';
        dlgResults.note = dlgResults.add('group');
        dlgResults.note.txt = dlgResults.note.add('statictext', undefined, 'Combined results across paths qualified based on options');
        dlgResults.tolerance = dlgResults.add('group');
        dlgResults.tolerance.txt = dlgResults.tolerance.add('statictext', undefined, "Tolerance applied (in PostScript points): ");
        dlgResults.tolerance.val = dlgResults.tolerance.add('statictext', undefined, tolerance);

        /* Add execution buttons */
        dlgResults.executeGrp = dlgResults.add('group', undefined, 'Execute:');
        dlgResults.executeGrp.orientation='row';
        dlgResults.executeGrp.buildBtn1= dlgResults.executeGrp.add('button',undefined, 'OK', {name:'ok'});
        dlgResults.executeGrp.buildBtn1.onClick= resultsActionOk;

        dlgResults.frameLocation = [100, 100];
        dlgResults.show();
}

function resultsActionOk() {
        exitError = 0;
        dlgResults.hide();
}
