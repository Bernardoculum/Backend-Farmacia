import { Module, Global } from '@nestjs/common';
import { BranchScopeService } from './branch-scope.service';
import { BranchScopeInterceptor } from './branch-scope.interceptor';

@Global()
@Module({
  providers: [BranchScopeService, BranchScopeInterceptor],
  exports: [BranchScopeService, BranchScopeInterceptor],
})
export class BranchScopeModule {}
