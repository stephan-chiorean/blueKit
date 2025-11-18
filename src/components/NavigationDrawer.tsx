import {
  DrawerRoot,
  DrawerBackdrop,
  DrawerPositioner,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerCloseTrigger,
  TreeView,
  createTreeCollection,
} from '@chakra-ui/react';

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TreeNode {
  id: string;
  name: string;
  children?: TreeNode[];
}

const treeData: TreeNode[] = [
  {
    id: '1',
    name: 'Folder 1',
    children: [
      { id: '1-1', name: 'Subfolder 1-1' },
      { id: '1-2', name: 'Subfolder 1-2' },
    ],
  },
  {
    id: '2',
    name: 'Folder 2',
    children: [
      { id: '2-1', name: 'Subfolder 2-1' },
      { id: '2-2', name: 'Subfolder 2-2' },
    ],
  },
  {
    id: '3',
    name: 'Folder 3',
  },
];

const TreeNode = (props: { node: TreeNode; indexPath: number[] }) => {
  const { node, indexPath } = props;
  
  if (node.children && node.children.length > 0) {
    return (
      <TreeView.NodeProvider key={node.id} node={node} indexPath={indexPath}>
        <TreeView.Branch>
          <TreeView.BranchControl>
            <TreeView.BranchIndicator />
            <TreeView.BranchText>{node.name}</TreeView.BranchText>
          </TreeView.BranchControl>
          <TreeView.BranchContent>
            <TreeView.BranchIndentGuide />
            {node.children.map((child, index) => (
              <TreeNode
                key={child.id}
                node={child}
                indexPath={[...indexPath, index]}
              />
            ))}
          </TreeView.BranchContent>
        </TreeView.Branch>
      </TreeView.NodeProvider>
    );
  }
  
  return (
    <TreeView.NodeProvider key={node.id} node={node} indexPath={indexPath}>
      <TreeView.Item>
        <TreeView.ItemText>{node.name}</TreeView.ItemText>
      </TreeView.Item>
    </TreeView.NodeProvider>
  );
};

export default function NavigationDrawer({ isOpen, onClose }: NavigationDrawerProps) {
  // Create collection with root node - TreeView requires it
  const collection = createTreeCollection({
    rootNode: { id: 'root', name: 'root', children: treeData },
  });

  return (
    <DrawerRoot open={isOpen} onOpenChange={(e) => !e.open && onClose()} placement="start">
      <DrawerBackdrop />
      <DrawerPositioner>
        <DrawerContent>
          <DrawerHeader>Navigation</DrawerHeader>
          <DrawerCloseTrigger />
          <DrawerBody>
            <TreeView.Root collection={collection} defaultExpandedValue={[]}>
              <TreeView.Tree>
                {treeData.map((node, index) => (
                  <TreeNode key={node.id} node={node} indexPath={[index]} />
                ))}
              </TreeView.Tree>
            </TreeView.Root>
          </DrawerBody>
        </DrawerContent>
      </DrawerPositioner>
    </DrawerRoot>
  );
}
