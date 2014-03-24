/**
 * Controller namespace
 */
ctr = function Ctr( json ){
	this.view = new vw();
	this.model = new dm();
	this.path = null;	// array of nodes
	this.callbacks = {
		"context": this,
		"nav": this.nav,
		"newPoint": this.onPointCreate,
		"newEdge": this.onEdgeCreate,
		"delPoint": this.onPointDelete,
		"delEdge": this.onEdgeDelete,
		"updatePoint": this.onPointUpdate
	};
	this.currentFloor = null;
	this.user = null;
	// Initialization
	this.init( json );
};

ctr.prototype.init = function ( json ){
	this.model.init( json );
	this.view.init( this.callbacks );
	this.showGraph();
}

/**
 * Find shortest path to a destination; A* pathfinding
 * @param  {dm.Node} from Starting point
 * @param  {dm.Node} to   Destination
 */
ctr.prototype.findPath = function ( from, to ){
	closedset = [];	// The set of nodes already evaluated.
	openset = [from];	// The set of nodes to be evaluated, initially containing the start node
	path = [];

	if (from == to){
		return [from];
	}
	var h = function ( from, to ){	// Heuristic function
		// x^2 + y^2
		return Math.pow(to.coords[0] - from.coords[0], 2) + Math.pow(to.coords[1] - from.coords[1], 2);
	};
	var leastF = function (){	// Find node in open set with least f value
		var f = Number.POSITIVE_INFINITY, idx = -1;
		for (var i = 0; i < openset.length; i++){
			if (openset[i].f < f){
				f = openset[i].f;
				idx = i;
			}
		}
		return idx;
	};
	var inClosedSet = function ( node ){	// Check if node is already examined
		for (var i = 0; i < closedset.length; i++){
			if (closedset[i] == node){
				return true;
			}
		}
		return false;
	};
	var rebuildPath = function ( from, to ){	// Rebuild path based on last node returned
		current = to;
		while (current != from){
			path.push(current);
			current = current.parent;
		}
		path.push(current);	// start node
	};
	// While there still are nodes to check
	while (openset.length != 0){
		// find the node with the least f in the open set, remove it from the open set
		var i = leastF(),
			n = openset[i];
		openset.splice(i, 1);
		// for every of its children
		for (i = 0; i < n.vectors.length; i++){
			var child = n.vectors[i];
			if (!inClosedSet(child)){	// if not previously examined
				// set where we came from
				child.parent = n;
				// n.g + distance *squared* between child & n
				child.g = n.g + h( child, n );
				// distance *squared* between goal & child
				child.h = h( child, to );
				child.f = child.g + child.h;
				// if child is the goal, stop the search & build the graph
				if (child == to){
					rebuildPath( from, child );
					return path.reverse();
				}
				// Else add child to open set for futher examination
				openset.push(child);
			}
		}
		// push n to the closed list
		closedset.push(n);
	}
	return null;	// failure
};

/**
 * Compare several paths to various destinations and find the shortest
 * @param  {Array} paths Array of paths to compare
 * @return {Array}       The shortest path among all paths
 */
ctr.prototype.comparePaths = function ( paths ){
	var path, distance = Number.POSITIVE_INFINITY;
	for (var i = 0; i < paths.length; i++){
		// last node's f value is the total distance
		// distance in form d1^2 + d2^2 + ... + dn^2
		if (paths[i][paths[i].length-1].f < distance){
			distance = paths[i][paths[i].length-1].f;
			path = paths[i];
		}
	}
	return path;
};

/**
 * Create navigation to user destination
 */
ctr.prototype.navigate = function ( from, to ){
	// If on same floor
	if (from.floor == to.floor){
		this.path = this.findPath( from, to );
	} else {	// On separate floors; find elevation instead
		// Find nearest elevation
		var elev = this.model.findPlaces(dm.Place.SPECIAL_TAG_ELEVATION, from.floor);
		var paths = [];
		for (var i = 0; i < elev.length; i++){
			paths.push( this.findPath( from, elev[i] ) );
		}
		if (paths.length == 1){
			this.path = paths[0];
		} else {
			this.path = this.comparePaths(paths);
		}
	}
};

/**
 * Show user the navigation
 */
ctr.prototype.showNav = function (){
	// tmp implementation
	for (var i = 0; i < this.path.length; i++){
		this.view.newPoint( this.path[i], true );
		if (i > 0){
			this.view.newEdge( this.path[i], this.path[i-1], true );
		}
	}
};

ctr.prototype.showGraph = function (){
	this.view.clear();
	for (var i = 0; i < this.model.model.nodes.length; i++){
		// TODO check floor
		var n = this.model.model.nodes[i];
		this.view.newPoint( n );
		for (var j = 0; j < n.vectors.length; j++){
			var v = n.vectors[j];
			this.view.newEdge( n, v );
		}
	}
};

ctr.prototype.getJSON = function (){
	return this.model.getJSON();
};

// by mouse location
// param: not dm.Node
ctr.prototype.findNodeByViewCoord = function ( p ){
	for (var i = 0; i < this.model.model.nodes.length; i++){
		var n = this.model.model.nodes[i];
		if (p.coords[0] == n.coords[0] && p.coords[1] == n.coords[1]){
			return this.model.model.nodes[i];
		}
	}
	return null;
};

// Callback; tmp
// param: not dm.Node
ctr.prototype.nav = function ( from, to ){
	var self = this.context;
	from = self.findNodeByViewCoord(from);
	to = self.findNodeByViewCoord(to);
	self.path = self.findPath( from, to );
	if (self.path == null){
		throw new Error("No path found");
	}
	self.showNav();
};

// param: not dm.Node
ctr.prototype.onPointCreate = function ( p ){
	var self = this.context,
		nlist = self.model.model.nodes,
		json = {
			'GID': null,
			'Coords': [p.coords[0],p.coords[1]],
			'Vectors': [],
			'Type': p.type,
			'Floor': self.model.model.floors[0]	// TODO: current floor
		};
	if (nlist.length === 0){
		json.GID = '0';
	} else {
		json.GID = nlist.length.toString();
	}
	nlist.push( new dm.Node( json ) );
	self.view.newPoint( p );
};

// param: not dm.Node
ctr.prototype.onEdgeCreate = function ( p1, p2 ){
	var self = this.context;
	if ( p1 == p2 ){
		console.log("Warning: No edges created - duplicate vertices");
		return;
	}
	p1 = self.findNodeByViewCoord(p1);
	p2 = self.findNodeByViewCoord(p2);
	if (!p1.isNeighbor(p2)){
		p1.vectors.push(p2);
		p2.vectors.push(p1);
		self.view.newEdge( p1, p2 );
	} else {
		console.log("Warning: No edges created - duplicate edge");
	}
};

// param: not dm.Node
ctr.prototype.onPointDelete = function ( p ){
	var self = this.context;
	var nlist = self.model.model.nodes;
	p1 = self.findNodeByViewCoord(p);
	var v = p1.vectors;
	// Clean up edges
	for (var i = 0; i < v.length; i++){
		var p2 = v[i];
		for (var j = 0; j < p2.vectors.length; j++){
			if (p2.vectors[j] == p1){
				p2.vectors.splice(j, 1);
				break;
			}
		}
	}
	// Delete node
	for (var i = 0; i < nlist.length; i++){
		if (nlist[i] == p1){
			nlist.splice(i, 1);
			break;
		}
	}
	self.showGraph();
};

// param: not dm.Node
ctr.prototype.onEdgeDelete = function ( p1, p2 ){
	var self = this.context;
	p1 = self.findNodeByViewCoord(p1);
	p2 = self.findNodeByViewCoord(p2);
	for (var i = 0; i < p1.vectors.length; i++){
		if (p1.vectors[i] == p2){
			p1.vectors.splice(i, 1);
			break;
		}
	}
	for (var i = 0; i < p2.vectors.length; i++){
		if (p2.vectors[i] == p1){
			p2.vectors.splice(i, 1);
			break;
		}
	}
	self.showGraph();
};

// param: not dm.Node
ctr.prototype.onPointUpdate = function ( p1, p2 ){
	var self = this.context;
	p1 = self.findNodeByViewCoord(p1);
	p1.coords[0] = p2.coords[0];
	p1.coords[1] = p2.coords[1];
	self.showGraph();
};